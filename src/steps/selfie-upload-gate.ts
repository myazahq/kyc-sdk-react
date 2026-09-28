import { useEffect, useMemo, useState } from 'react';
import {
  SELFIE_UPLOAD_TIMED_OUT,
  SELFIE_UPLOAD_WAIT_MS,
  selfieUploadSettled,
  type SelfieUploadState,
  type SelfieUploadWait,
} from '../lib/selfie-upload-wait';
import { useText } from '../i18n';

// ─── The submitted step's wait on the selfie upload ─────────────────────────
//
// The reducer has no subscribe, so the pure `awaitSelfieUpload` (the mobile
// SDKs' shape) becomes a hook here: the same settlement rule
// (`selfieUploadSettled`) read on every render, plus the same 90 s bound.
// Disabled (a flow that shows the review) it is settled from the start, so
// the submission fires exactly as it always did.

export type SelfieUploadGate = 'waiting' | SelfieUploadWait;

export function useSelfieUploadGate(opts: {
  enabled: boolean;
  selfieUpload: SelfieUploadState;
  selfieMediaId: string | undefined;
}): SelfieUploadGate {
  const { enabled, selfieUpload, selfieMediaId } = opts;
  const t = useText();
  const [timedOut, setTimedOut] = useState(false);
  const raw = enabled ? selfieUploadSettled({ selfieUpload, selfieMediaId }) : { ok: true as const };
  // The library's own fallback message is SDK copy: read it from the catalogue.
  // An upload error's own message (from the server or network) passes through.
  const settled =
    raw && !raw.ok && raw.message === SELFIE_UPLOAD_TIMED_OUT
      ? { ok: false as const, message: t('presence.upload.failed') }
      : raw;

  useEffect(() => {
    if (!enabled || settled) return;
    const timer = setTimeout(() => setTimedOut(true), SELFIE_UPLOAD_WAIT_MS);
    return () => clearTimeout(timer);
    // Re-armed only when the wait (re)starts, never per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, settled === null]);

  return useMemo<SelfieUploadGate>(() => {
    if (settled) return settled;
    if (timedOut) return { ok: false, message: t('presence.upload.failed') };
    return 'waiting';
    // A settled object is rebuilt per render; key the memo on its fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled?.ok, settled && !settled.ok ? settled.message : null, timedOut, t]);
}
