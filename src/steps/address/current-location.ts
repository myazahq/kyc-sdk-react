import { resolveMyLocation } from '../address-helpers';
import { SAMPLE_ADDRESS_LINE } from './flow-steps';
import type { AddressParts } from '../../services/api';

// The device's current location, fetched ONCE per page session and shared by
// every address step (module-level on purpose — the flow hook remounts per
// step, and re-prompting or re-fixing on every screen is exactly the
// hesitation this exists to remove). The GPS warm-up runs while the person is
// still reading the SEARCH screen, so by the pin step the fix — and its
// reverse-geocoded address — are usually already in hand: the map lands right
// first time instead of showing a default view and then jumping.

export interface CurrentFix {
  lat: number;
  lng: number;
  accuracy: number | null;
  /** The reverse-geocoded line ("11 Bassey Street, Calabar"), when known. */
  label: string | null;
  parts: AddressParts | null;
}

interface ReverseApi {
  addressReverse(lat: number, lng: number): Promise<{ line: string | null; parts?: AddressParts | null }>;
}

let resolved: CurrentFix | null = null;
let inflight: Promise<CurrentFix | null> | null = null;
let failed = false;

/** The fix, when one has already resolved this session. */
export function currentFix(): CurrentFix | null {
  return resolved;
}

/** Is a fix attempt still running? */
export function locating(): boolean {
  return inflight !== null && resolved === null;
}

/**
 * Start (or join) the one location attempt. Safe to call from every address
 * step's mount; the OS permission prompt fires at most once. Resolves null on
 * a denied/failed read — callers fall back to the manual pin.
 */
export function prefetchCurrentFix(
  api: ReverseApi,
  preview: boolean | undefined,
  opts?: { retry?: boolean },
): Promise<CurrentFix | null> {
  if (resolved) return Promise.resolve(resolved);
  // A failed attempt (denied prompt, no fix) is not retried AUTOMATICALLY —
  // every step mount re-starting it made the row spin forever and re-prompt.
  // An explicit tap on the row passes retry and gets a fresh attempt.
  if (failed && !inflight && !opts?.retry) return Promise.resolve(null);
  if (!inflight) {
    inflight = (async () => {
      try {
        const fix = await resolveMyLocation(preview);
        let label: string | null = null;
        let parts: AddressParts | null = null;
        if (preview) {
          // The builder preview never reverse-geocodes (the canned fix is not
          // a place; labelling it with a real address spent geocoder quota
          // per preview render) — same sample line the pin label uses.
          label = SAMPLE_ADDRESS_LINE;
        } else {
          try {
            const r = await api.addressReverse(fix.lat, fix.lng);
            label = r.line ?? null;
            parts = r.parts ?? null;
          } catch {
            /* the coordinates alone are still a fix */
          }
        }
        resolved = { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, label, parts };
        failed = false;
        return resolved;
      } catch {
        inflight = null; // an explicit later tap may retry (e.g. permission granted since)
        failed = true;
        return null;
      }
    })();
  }
  return inflight;
}
