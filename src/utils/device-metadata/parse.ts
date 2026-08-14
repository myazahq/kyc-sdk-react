// User-Agent parsing — small, dependency-free, good-enough for analytics.

export function parseBrowser(ua: string): { name: string; version?: string; engine?: string } {
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

export function parseOS(ua: string): { name: string; version?: string } {
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

export function parseDeviceType(ua: string): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
	if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua)) return 'tablet';
	if (/Android(?!.*Mobile)/.test(ua)) return 'tablet';
	if (/Mobi|Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'mobile';
	return 'desktop';
}

/**
 * Chrome's reduced-UA placeholder for the Android device model.
 *
 * Since Chrome 110 the Android User-Agent is frozen to `Android 10; K` on every
 * device — the OS version is always "10" and the model is always the literal
 * "K", whatever the hardware. It is a redaction, not a name, so reporting it
 * gives a dashboard reading "K K" for most Android traffic. The real model is
 * available, but only through the async client-hints call primed below.
 */
const REDUCED_UA_MODEL = 'K';

export function parseDeviceModel(ua: string): { vendor?: string; model?: string } {
	if (/iPhone/.test(ua)) return { vendor: 'Apple', model: 'iPhone' };
	if (/iPad/.test(ua)) return { vendor: 'Apple', model: 'iPad' };
	if (/iPod/.test(ua)) return { vendor: 'Apple', model: 'iPod' };
	if (/Macintosh/.test(ua)) return { vendor: 'Apple', model: 'Mac' };
	const android = ua.match(/Android[^;]*;\s*([^)]+?)(?:\s+Build|;|\))/);
	if (android) {
		const raw = android[1].trim().replace(/\s+/g, ' ');
		// Report nothing rather than the placeholder: an absent model is
		// honest, "K" looks like a parsing bug and reads like one too.
		if (raw === REDUCED_UA_MODEL) return {};
		return { vendor: raw.split(/\s+/)[0], model: raw };
	}
	return {};
}
