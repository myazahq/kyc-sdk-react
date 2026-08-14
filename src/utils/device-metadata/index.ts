// Rich device & SDK metadata collected from the browser at verify time.
// Sent as `metadata.device` in the verify payload — the server merges this
// with server-side facts (real IP, request user-agent, X-SDK-Version header)
// before persisting to Verification.deviceMetadata.

import { getIntegrityMetadata } from '../../lib/integrity-signals';
import { getStepLog } from '../../lib/step-log';
import { SDK_TYPE, SDK_VERSION } from './types';
import type { NavigatorWithExtras, WebDeviceMetadata } from './types';
import { parseBrowser, parseOS, parseDeviceType, parseDeviceModel } from './parse';
import { getDeviceHints } from './hints';

export { SDK_TYPE, SDK_VERSION } from './types';
export type { WebDeviceMetadata } from './types';
export { primeDeviceHints } from './hints';

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
		const parsed = parseDeviceModel(ua);

		// Client hints win where they exist: on Android they carry the real
		// model and OS version, and the UA carries a redaction of both. The
		// vendor is derived from the model's first token, as with a full UA.
		const hints = getDeviceHints();
		const hintedModel = hints?.model;
		const model = hintedModel || parsed.model;
		const vendor = hintedModel ? hintedModel.split(/\s+/)[0] : parsed.vendor;
		if (hints?.platformVersion) os.version = hints.platformVersion;

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

		// Step journey recorded during the session — powers the dashboard's
		// verification timeline. See lib/step-log.
		const stepLog = getStepLog();
		if (stepLog) {
			(meta as WebDeviceMetadata & { stepLog?: unknown }).stepLog = stepLog;
		}

		return meta;
	} catch {
		return fallback;
	}
}

