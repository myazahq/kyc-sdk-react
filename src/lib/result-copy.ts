import type { VerificationOutcome } from './result-wait';
import type { BiometricCopyText } from './biometric-options';
import { defaultText } from '../i18n/translate';
import type { TextFn } from '../i18n/types';

// ─── What the terminal screens say ──────────────────────────────────────────
//
// Pure so it is testable without React. The server's own reason wins on a
// decline or an error when it sent one: it is written for the applicant.
// UK English, no em dashes (user-facing copy rule). Mirrors the mobile SDKs'
// result copy word for word; keep the three in lockstep. The words come from
// the text catalogue (i18n/groups/result-*.ts) through `t`, and the org's
// dedicated biometric.copy fields ride as the legacy value, so they still win.

export type ResultTone = 'success' | 'error' | 'info';

export interface ResultCopy {
  tone: ResultTone;
  title: string;
  description: string;
}

export interface WaitingCopy {
  title: string;
  description: string;
}

/**
 * The ONE loading screen after the capture. On a re-authentication that waits
 * for its verdict it spans the selfie upload, the submission and the poll, so
 * it names the check rather than any of the three steps behind it. A retry in
 * flight replaces the description, never the title: the person is still
 * waiting for the same thing. `override` is the org's own words for the
 * screen (lib/biometric-copy.ts), field by field over the default.
 */
export function describeWaiting(
  opts: {
    scope: string | null;
    waitsForResult: boolean;
    retry?: { attempt: number; total: number } | null;
    override?: BiometricCopyText | null;
  },
  t: TextFn = defaultText,
): WaitingCopy {
  const prefix = waitingKeyFor(opts.scope, opts.waitsForResult);
  const title = t(`${prefix}.title`, undefined, opts.override?.title);
  if (opts.retry) {
    return { title, description: t('result.submitting.retrying', { attempt: opts.retry.attempt, total: opts.retry.total }) };
  }
  return { title, description: t(`${prefix}.description`, undefined, opts.override?.description) };
}

function waitingKeyFor(scope: string | null, waitsForResult: boolean): string {
  if (scope === 'biometric-authentication') {
    return waitsForResult ? 'result.faceCheck.checking' : 'result.faceCheck.sending';
  }
  if (scope === 'biometric-enrollment') return 'result.faceEnrolment.saving';
  return 'result.submitting';
}

/** A title and description from the catalogue, the org's words (if any) over each. */
function screen(t: TextFn, prefix: string, override?: BiometricCopyText | null): WaitingCopy {
  return {
    title: t(`${prefix}.title`, undefined, override?.title),
    description: t(`${prefix}.description`, undefined, override?.description),
  };
}

/** What the person is told, per outcome. The server's own reason wins on a
 *  decline or an error when it sent one; it is written for the applicant.
 *  `copy` is the org's own words for the two verdict screens: on a decline
 *  its description wins even over the server's reason, since the org chose
 *  to say that (as does the workflow's own text for that description). */
export function describeOutcome(
  outcome: VerificationOutcome,
  copy?: { verified?: BiometricCopyText | null; declined?: BiometricCopyText | null },
  t: TextFn = defaultText,
): ResultCopy {
  if (outcome.kind === 'timeout') return { tone: 'info', ...screen(t, 'result.faceCheck.timeout') };
  switch (outcome.status) {
    case 'approved':
      return { tone: 'success', ...screen(t, 'result.faceCheck.verified', copy?.verified) };
    case 'declined': {
      const words = screen(t, 'result.faceCheck.declined', copy?.declined);
      const orgChose =
        Boolean(copy?.declined?.description) ||
        words.description !== defaultText('result.faceCheck.declined.description');
      return { tone: 'error', title: words.title, description: orgChose ? words.description : (outcome.reason ?? words.description) };
    }
    case 'in_review':
      return { tone: 'info', ...screen(t, 'result.faceCheck.inReview') };
    case 'error': {
      const words = screen(t, 'result.faceCheck.error');
      return { tone: 'error', title: words.title, description: outcome.reason ?? words.description };
    }
    default:
      return { tone: 'info', ...screen(t, 'result.faceCheck.submitted') };
  }
}
