// One-shot geolocation helpers for the address-collection step, split out per
// the 200-line rule and so the fix logic stays pure-ish and testable.

import { isAcceptedAddressPhoto } from '../components/AddressPhotoUpload';

const FIX_TIMEOUT_MS = 8_000;

export function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('geolocation unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: FIX_TIMEOUT_MS,
      maximumAge: 30_000,
    });
  });
}

/**
 * The attest-presence device fix, as the fields the verify body carries.
 * Best-effort by contract: a denied prompt or a slow read returns {} and the
 * submission simply goes without the `attested` tier.
 */
export async function deviceFixFields(): Promise<{
  deviceLat?: number;
  deviceLng?: number;
  deviceAccuracy?: number;
  capturedAt?: string;
}> {
  try {
    const fix = await currentPosition();
    return {
      deviceLat: fix.coords.latitude,
      deviceLng: fix.coords.longitude,
      ...(typeof fix.coords.accuracy === 'number' ? { deviceAccuracy: fix.coords.accuracy } : {}),
      capturedAt: new Date(fix.timestamp || Date.now()).toISOString(),
    };
  } catch {
    return {};
  }
}

/** Accuracy at which a fix is good enough to stop waiting for GPS. */
const PRECISE_ENOUGH_M = 25;
const PRECISE_WINDOW_MS = 8_000;
/** Once ANY fix exists, wait only this much longer for a better one — a
 *  desktop wifi fix never reaches 25m, and waiting the full window for an
 *  accuracy that is not coming reads as "keeps loading". */
const FIRST_FIX_GRACE_MS = 3_000;

/**
 * A PRECISE fix: watch the position for up to ~9s and keep the most accurate
 * reading, resolving early once it is within ~20m. A single getCurrentPosition
 * routinely answers with the first coarse wifi/cell fix (hundreds of metres)
 * before the GPS has warmed up — which is exactly the pin landing on the wrong
 * compound. maximumAge 0: never accept a cached fix for a pin.
 */
export function precisePosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('geolocation unavailable'));
      return;
    }
    let best: GeolocationPosition | null = null;
    let settled = false;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;
    const finish = (pos: GeolocationPosition | null, err?: GeolocationPositionError) => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      if (graceTimer) clearTimeout(graceTimer);
      if (pos) resolve(pos);
      else reject(err ?? new Error('no fix'));
    };
    const timer = setTimeout(() => finish(best), PRECISE_WINDOW_MS);
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || (pos.coords.accuracy ?? Infinity) < (best.coords.accuracy ?? Infinity)) best = pos;
        if ((pos.coords.accuracy ?? Infinity) <= PRECISE_ENOUGH_M) {
          finish(pos);
          return;
        }
        // First usable fix: give the GPS a short grace to improve, then take
        // the best on hand rather than waiting out the whole window.
        if (!graceTimer) graceTimer = setTimeout(() => finish(best), FIRST_FIX_GRACE_MS);
      },
      (err) => finish(best, err),
      { enableHighAccuracy: true, timeout: PRECISE_WINDOW_MS, maximumAge: 0 },
    );
  });
}

/** The Use-my-location fix: a canned Lagos pin in builder preview, the real
 *  precise (best-of-watch) geolocation fix otherwise. Throws on a denied or
 *  failed read. */
export async function resolveMyLocation(
  preview: boolean | undefined,
): Promise<{ lat: number; lng: number; accuracy: number | null }> {
  if (preview) return { lat: 6.4281, lng: 3.4219, accuracy: 15 };
  const fix = await precisePosition();
  return { lat: fix.coords.latitude, lng: fix.coords.longitude, accuracy: fix.coords.accuracy ?? null };
}

/** The address state after picking a search candidate: the pin lands on the
 *  hit, the typed fields survive, and the house number prefills ONLY when the
 *  applicant has not typed one (their word always beats the map's). */
export function pickedAddressState(
  prev:
    | { directions?: string; propertyName?: string; propertyNumber?: string; street?: string }
    | null
    | undefined,
  hit: { lat: number; lng: number; houseNumber: string | null },
): {
  lat: number;
  lng: number;
  accuracy: null;
  directions: string;
  propertyName: string;
  propertyNumber: string;
  street: string | undefined;
} {
  return {
    lat: hit.lat,
    lng: hit.lng,
    accuracy: null,
    directions: prev?.directions ?? '',
    propertyName: prev?.propertyName ?? '',
    propertyNumber: prev?.propertyNumber?.trim() ? prev.propertyNumber : (hit.houseNumber ?? ''),
    // Undefined, not '': the details sheet reads '' as "deliberately cleared"
    // and undefined as "never touched" — initialising with '' suppressed the
    // resolved-street prefill forever.
    street: prev?.street,
  };
}

/** Validate + upload the entrance photo; the human-readable refusal is the
 *  thrown message (the step surfaces it verbatim). */
export async function uploadAddressPhoto(
  api: { upload(file: File, type: string): Promise<string> },
  file: File,
): Promise<string> {
  if (!isAcceptedAddressPhoto(file)) throw new Error('Please upload a photo (JPEG, PNG or WebP).');
  // Both mobile ports cap at 20MB; without a mirror here the web quietly
  // accepted anything and the server refused it later with a worse message.
  if (file.size > 20 * 1024 * 1024) throw new Error('Please upload a photo under 20MB.');
  try {
    return await api.upload(file, 'address_photo');
  } catch {
    throw new Error('Upload failed. Please check your connection and try again.');
  }
}
