import { useEffect, useRef } from 'react';
import type { KYCApi } from '../services/api';
import type { KYCState } from '../context/types';
import { progressFromState, progressFingerprint, isUntouchedProgress } from '../lib/session-progress';

/** Typing shouldn't put a request on the wire per keystroke. */
const SAVE_DEBOUNCE_MS = 800;

/**
 * Persist flow progress to the session as the user advances.
 *
 * Best-effort by contract: a failed save costs some re-typing on resume, and must
 * never interrupt someone mid-verification. Nothing here surfaces an error.
 *
 * No-ops without a session (preview, hosted mounts, or a start that failed), and
 * skips writes when nothing worth saving has actually changed — otherwise idle
 * re-renders would put the same payload back repeatedly.
 */
export function useSessionProgress(api: KYCApi, state: KYCState): void {
  const lastSaved = useRef<string | null>(null);
  const sessionId = state.sessionId;

  // Derived here rather than in the effect body so the fingerprint is the effect's
  // actual dependency — the state object identity changes on every render.
  const payload = sessionId ? progressFromState(state) : null;
  const fingerprint = payload ? progressFingerprint(payload) : null;

  useEffect(() => {
    if (!sessionId || !payload || !fingerprint) return;
    if (fingerprint === lastSaved.current) return;
    // Nothing has happened yet. Writing this would restore them to the screen
    // they are already on, and would make an untouched link indistinguishable
    // from one somebody worked through.
    if (isUntouchedProgress(payload)) return;

    const id = setTimeout(() => {
      lastSaved.current = fingerprint;
      void api.saveProgress(sessionId, payload).catch(() => {
        // Allow a later change to retry: a save that failed must not be
        // remembered as the last one that succeeded.
        lastSaved.current = null;
      });
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, sessionId, fingerprint]);
}
