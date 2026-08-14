import type { NavigatorWithExtras } from './types';

// ---------------------------------------------------------------------------
// User-Agent Client Hints — the only way back to the real model
// ---------------------------------------------------------------------------
//
// `getHighEntropyValues` returns the true model and OS version that the reduced
// UA hides. It is async and Chromium-only, so it is PRIMED early and read from
// a cache at submit time: `collectWebDeviceMetadata` is synchronous and called
// from the submit path, where there is nothing to await on. A flow lasts
// minutes, so by submission the answer has long since landed; if it has not, or
// the browser has no client hints (Firefox, Safari), the fields are simply
// absent — never guessed.

interface DeviceHints {
	model?: string;
	platformVersion?: string;
}

let deviceHints: DeviceHints | null = null;

/** The client-hint answer, if it has landed. Null until then, and on browsers
 *  that have no client hints at all. */
export function getDeviceHints(): DeviceHints | null {
  return deviceHints;
}

export function primeDeviceHints(): void {
	if (deviceHints || typeof navigator === 'undefined') return;
	const uaData = (navigator as NavigatorWithExtras).userAgentData;
	if (typeof uaData?.getHighEntropyValues !== 'function') return;
	uaData
		.getHighEntropyValues(['model', 'platformVersion'])
		.then((values) => {
			deviceHints = {
				model: values.model?.trim() || undefined,
				platformVersion: values.platformVersion?.trim() || undefined,
			};
		})
		.catch(() => {
			// Permissions-Policy can withhold the hints. Absent is fine.
		});
}
