// Rich device & SDK metadata collected from the browser at verify time.
// Sent as `metadata.device` in the verify payload — the server merges this
// with server-side facts (real IP, request user-agent, X-SDK-Version header)
// before persisting to Verification.deviceMetadata.

import { getIntegrityMetadata } from '../lib/integrity-signals';

export const SDK_TYPE = 'web' as const;

// Single source of truth for the SDK version — also used by services/api.ts
// for the X-SDK-Version header. Keep in sync with package.json.
export const SDK_VERSION = '2.5.0';

export interface WebDeviceMetadata {
	sdkType: 'web';
	sdkVersion: string;
	sdkPlatform: 'web';
	capturedAt: string;

	device: {
		type: 'mobile' | 'tablet' | 'desktop' | 'unknown';
		vendor?: string;
		model?: string;
	};
	os: {
		name: string;
		version?: string;
	};
	browser: {
		name: string;
		version?: string;
		engine?: string;
	};
	screen?: {
		width: number;
		height: number;
		availWidth?: number;
		availHeight?: number;
		devicePixelRatio: number;
		colorDepth?: number;
		orientation?: string;
	};
	viewport?: {
		width: number;
		height: number;
	};
	locale?: string;
	language?: string;
	languages?: string[];
	timezone?: string;
	timezoneOffsetMinutes?: number;
	hardware?: {
		cores?: number;
		memoryGb?: number;
		touchPoints?: number;
	};
	network?: {
		type?: string;
		downlinkMbps?: number;
		rttMs?: number;
		saveData?: boolean;
	};
	capabilities?: {
		cookies?: boolean;
		doNotTrack?: boolean;
		online?: boolean;
		webdriver?: boolean;
	};
	userAgent?: string;
	platform?: string;
}

interface NetworkInformation {
	effectiveType?: string;
	downlink?: number;
	rtt?: number;
	saveData?: boolean;
}

interface NavigatorWithExtras extends Navigator {
	deviceMemory?: number;
	connection?: NetworkInformation;
	mozConnection?: NetworkInformation;
	webkitConnection?: NetworkInformation;
	userAgentData?: {
		brands?: { brand: string; version: string }[];
		mobile?: boolean;
		platform?: string;
	};
}

// ---------------------------------------------------------------------------
// User-Agent parsing — small, dependency-free, good-enough for analytics.
// ---------------------------------------------------------------------------

function parseBrowser(ua: string): { name: string; version?: string; engine?: string } {
	const tests: Array<[RegExp, string, string?]> = [
		[/Edg\/([\d.]+)/, 'Edge', 'Blink'],
		[/OPR\/([\d.]+)/, 'Opera', 'Blink'],
		[/Chrome\/([\d.]+)/, 'Chrome', 'Blink'],
		[/CriOS\/([\d.]+)/, 'Chrome iOS', 'WebKit'],
		[/FxiOS\/([\d.]+)/, 'Firefox iOS', 'WebKit'],
		[/Firefox\/([\d.]+)/, 'Firefox', 'Gecko'],
		[/Version\/([\d.]+).*Safari/, 'Safari', 'WebKit'],
		[/MSIE ([\d.]+)/, 'Internet Explorer', 'Trident'],
		[/Trident\/.*rv:([\d.]+)/, 'Internet Explorer', 'Trident'],
	];
	for (const [re, name, engine] of tests) {
		const m = ua.match(re);
		if (m) return { name, version: m[1], engine };
	}
	return { name: 'Unknown' };
}

function parseOS(ua: string): { name: string; version?: string } {
	if (/Windows NT 10\.0/.test(ua)) return { name: 'Windows', version: '10/11' };
	if (/Windows NT 6\.3/.test(ua)) return { name: 'Windows', version: '8.1' };
	if (/Windows NT 6\.2/.test(ua)) return { name: 'Windows', version: '8' };
	if (/Windows NT 6\.1/.test(ua)) return { name: 'Windows', version: '7' };
	if (/Windows NT/.test(ua)) return { name: 'Windows' };

	const ios = ua.match(/OS (\d+)[._](\d+)(?:[._](\d+))? like Mac OS X/);
	if (ios) {
		const v = [ios[1], ios[2], ios[3]].filter(Boolean).join('.');
		return { name: 'iOS', version: v };
	}
	const ipad = /iPad/.test(ua);
	const iphone = /iPhone|iPod/.test(ua);
	if (ipad || iphone) return { name: 'iOS' };

	const macos = ua.match(/Mac OS X (\d+)[._](\d+)(?:[._](\d+))?/);
	if (macos) {
		const v = [macos[1], macos[2], macos[3]].filter(Boolean).join('.');
		return { name: 'macOS', version: v };
	}
	if (/Macintosh/.test(ua)) return { name: 'macOS' };

	const android = ua.match(/Android (\d+(?:\.\d+)*)/);
	if (android) return { name: 'Android', version: android[1] };
	if (/Android/.test(ua)) return { name: 'Android' };

	if (/CrOS/.test(ua)) return { name: 'Chrome OS' };
	if (/Linux/.test(ua)) return { name: 'Linux' };

	return { name: 'Unknown' };
}

function parseDeviceType(ua: string): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
	if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua)) return 'tablet';
	if (/Android(?!.*Mobile)/.test(ua)) return 'tablet';
	if (/Mobi|Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'mobile';
	return 'desktop';
}

function parseDeviceModel(ua: string): { vendor?: string; model?: string } {
	if (/iPhone/.test(ua)) return { vendor: 'Apple', model: 'iPhone' };
	if (/iPad/.test(ua)) return { vendor: 'Apple', model: 'iPad' };
	if (/iPod/.test(ua)) return { vendor: 'Apple', model: 'iPod' };
	if (/Macintosh/.test(ua)) return { vendor: 'Apple', model: 'Mac' };
	const android = ua.match(/Android[^;]*;\s*([^)]+?)(?:\s+Build|;|\))/);
	if (android) {
		const raw = android[1].trim().replace(/\s+/g, ' ');
		return { vendor: raw.split(/\s+/)[0], model: raw };
	}
	return {};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function collectWebDeviceMetadata(): WebDeviceMetadata {
	const fallback: WebDeviceMetadata = {
		sdkType: SDK_TYPE,
		sdkVersion: SDK_VERSION,
		sdkPlatform: 'web',
		capturedAt: new Date().toISOString(),
		device: { type: 'unknown' },
		os: { name: 'Unknown' },
		browser: { name: 'Unknown' },
	};

	if (typeof window === 'undefined' || typeof navigator === 'undefined') {
		return fallback;
	}

	try {
		const nav = navigator as NavigatorWithExtras;
		const ua = nav.userAgent || '';

		const browser = parseBrowser(ua);
		const os = parseOS(ua);
		const type = parseDeviceType(ua);
		const { vendor, model } = parseDeviceModel(ua);

		const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

		const meta: WebDeviceMetadata = {
			sdkType: SDK_TYPE,
			sdkVersion: SDK_VERSION,
			sdkPlatform: 'web',
			capturedAt: new Date().toISOString(),
			device: { type, ...(vendor && { vendor }), ...(model && { model }) },
			os,
			browser,
			userAgent: ua,
			platform: nav.platform || nav.userAgentData?.platform,
		};

		if (typeof window.screen !== 'undefined') {
			meta.screen = {
				width: window.screen.width,
				height: window.screen.height,
				availWidth: window.screen.availWidth,
				availHeight: window.screen.availHeight,
				devicePixelRatio: window.devicePixelRatio || 1,
				colorDepth: window.screen.colorDepth,
				orientation: window.screen.orientation?.type,
			};
		}

		meta.viewport = {
			width: window.innerWidth,
			height: window.innerHeight,
		};

		try {
			meta.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		} catch {
			/* unsupported */
		}
		meta.timezoneOffsetMinutes = -new Date().getTimezoneOffset();
		meta.locale = nav.language;
		meta.language = nav.language;
		meta.languages = Array.isArray(nav.languages) ? [...nav.languages] : undefined;

		meta.hardware = {
			cores: nav.hardwareConcurrency,
			memoryGb: nav.deviceMemory,
			touchPoints: nav.maxTouchPoints,
		};

		if (conn) {
			meta.network = {
				type: conn.effectiveType,
				downlinkMbps: conn.downlink,
				rttMs: conn.rtt,
				saveData: conn.saveData,
			};
		}

		meta.capabilities = {
			cookies: nav.cookieEnabled,
			doNotTrack: nav.doNotTrack === '1' || nav.doNotTrack === 'yes',
			online: nav.onLine,
			webdriver: nav.webdriver,
		};

		// Capture-integrity signals collected during the session (virtual-camera
		// heuristics + how Presence Intelligence ran). See lib/integrity-signals.
		const integrity = getIntegrityMetadata();
		if (integrity) {
			(meta as WebDeviceMetadata & { integrity?: unknown }).integrity = integrity;
		}

		return meta;
	} catch {
		return fallback;
	}
}
