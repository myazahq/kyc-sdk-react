import { describeOutcome, type ResultTone } from '../lib/result-copy';
import type { ResolvedBiometricCopy } from '../lib/biometric-copy';
import type { WorkflowScope } from '../lib/scope';
import type { ApplicantOutcome } from '../services/api';
import type { TerminalTone } from './SubmittedScreens';
import { defaultText } from '../i18n/translate';
import type { TextFn } from '../i18n/types';

// ─── What a DECIDED session says when its applicant comes back ──────────────
//
// The returning-link screen used to word every verdict for a KYB applicant:
// "This business has been verified" on a face check, an address check, a
// person's own KYC (user report 2026-09-08). The words now name WHAT was
// verified, by subject and scope, and a re-authentication goes through the
// SAME describeOutcome the in-flow verdict screen renders, org copy included,
// so the person returning recognises the screen they left. Pure, so it is
// testable without React.

export interface DecidedCopy {
  tone: TerminalTone;
  title: string;
  description: string;
}

type Kind = 'business' | 'individual' | Exclude<WorkflowScope, 'biometric-authentication'>;

/** The catalogue's name for each kind (result.completed.*.description.<kind>). */
const KIND_KEY: Record<Kind, string> = {
  business: 'business',
  individual: 'individual',
  address: 'address',
  'biometric-enrollment': 'faceEnrolment',
  questionnaire: 'questionnaire',
  contact: 'contact',
};

const TONE_OF: Record<ResultTone, TerminalTone> = { success: 'success', error: 'declined', info: 'neutral' };

export interface DecidedContext {
  isBusiness: boolean;
  scope: WorkflowScope | null;
  /** The server's own reason, user-safe prose by contract; wins over the generic line. */
  reason: string | null;
  /** The org's own words for a biometric flow's verdict screens (lib/biometric-copy.ts). */
  words: ResolvedBiometricCopy;
}

/**
 * The verdict copy, or null when nothing has been decided: `submitted` keeps
 * the org's own success copy, since overriding it would be a downgrade.
 */
export function decidedCopy(
  outcome: ApplicantOutcome,
  ctx: DecidedContext,
  t: TextFn = defaultText,
): DecidedCopy | null {
  switch (outcome) {
    case 'submitted':
      return null;
    case 'action_needed':
      return {
        tone: 'neutral',
        title: t('result.completed.actionNeeded.title'),
        description: ctx.reason || t('result.completed.actionNeeded.description'),
      };
    // Ours, not theirs, so it says so rather than reading as a rejection.
    case 'error':
      return {
        tone: 'neutral',
        title: t('result.completed.error.title'),
        description: ctx.reason || t('result.completed.error.description'),
      };
    case 'approved':
    case 'declined': {
      // A face check's verdict is the in-flow screen's, word for word: the
      // default, the org's own copy, and a declined description that wins over
      // the server's reason, exactly as describeOutcome decides it there.
      if (ctx.scope === 'biometric-authentication') {
        const r = describeOutcome({ kind: 'settled', status: outcome, reason: ctx.reason, reasonCode: null }, ctx.words, t);
        return { tone: TONE_OF[r.tone], title: r.title, description: r.description };
      }
      const kind: Kind = ctx.scope ?? (ctx.isBusiness ? 'business' : 'individual');
      return outcome === 'approved'
        ? {
            tone: 'success',
            title: t(
              kind === 'biometric-enrollment'
                ? 'result.completed.approved.title.faceEnrolment'
                : 'result.completed.approved.title',
            ),
            description: ctx.reason || t(`result.completed.approved.description.${KIND_KEY[kind]}`),
          }
        : {
            tone: 'declined',
            title: t('result.completed.declined.title'),
            description: ctx.reason || t(`result.completed.declined.description.${KIND_KEY[kind]}`),
          };
    }
  }
}
