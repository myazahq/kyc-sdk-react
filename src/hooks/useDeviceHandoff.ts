'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KYCApi, HandoffSessionSnapshot } from '../services/api';

/**
 * Lifecycle of the desktop side of a device handoff:
 * - `creating`  — minting the session (initial / after regenerate)
 * - `waiting`   — session live, QR shown, nobody has scanned yet
 * - `opened`    — the phone fetched the bootstrap; it's working on the flow
 * - `submitted` — the phone submitted; `verificationId` is available
 * - `expired`   — the 15-min TTL elapsed without a submission
 * - `error`     — the session couldn't be created
 */
export type DeviceHandoffPhase = 'creating' | 'waiting' | 'opened' | 'submitted' | 'expired' | 'error';

export interface DeviceHandoffState {
  phase: DeviceHandoffPhase;
  /** Human-typable / copyable short code (display only). */
  code: string | null;
  /** Hosted-page URL the QR encodes (also copyable as a link). */
  url: string | null;
  sessionId: string | null;
  /** Set once the phone submits (`phase === 'submitted'`). */
  verificationId: string | null;
  error: string | null;
  /** Mint a fresh session (used after expiry). */
  regenerate: () => void;
}

const POLL_INTERVAL_MS = 2500;

/**
 * Drives the desktop handoff session: creates it, then polls until the phone
 * submits (or the link expires). Pure state — the caller reacts to
 * `phase === 'submitted'` to fire `onSubmit`. `snapshot` is intentionally NOT a
 * dependency (it's a fresh object each render); regenerate via `regenerate()`.
 */
export function useDeviceHandoff(
  api: KYCApi,
  snapshot: HandoffSessionSnapshot,
  enabled: boolean,
): DeviceHandoffState {
  const [phase, setPhase] = useState<DeviceHandoffPhase>('creating');
  const [code, setCode] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const regenerate = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const stopPoll = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    setPhase('creating');
    setError(null);
    setVerificationId(null);

    api
      .createHandoffSession(snapshotRef.current)
      .then((res) => {
        if (cancelled) return;
        setSessionId(res.sessionId);
        setCode(res.code);
        setUrl(res.url);
        setPhase('waiting');

        pollRef.current = setInterval(async () => {
          try {
            const s = await api.getHandoffSession(res.sessionId);
            if (cancelled) return;
            if (s.status === 'submitted') {
              setVerificationId(s.verificationId ?? null);
              setPhase('submitted');
              stopPoll();
            } else if (s.status === 'expired') {
              setPhase('expired');
              stopPoll();
            } else if (s.status === 'opened') {
              setPhase('opened');
            }
          } catch {
            /* transient poll failure — keep polling */
          }
        }, POLL_INTERVAL_MS);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not start device handoff.');
        setPhase('error');
      });

    return () => {
      cancelled = true;
      stopPoll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, enabled, nonce]);

  return { phase, code, url, sessionId, verificationId, error, regenerate };
}
