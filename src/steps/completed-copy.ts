import { describeOutcome, type ResultTone } from '../lib/result-copy';
import type { ResolvedBiometricCopy } from '../lib/biometric-copy';
import type { WorkflowScope } from '../lib/scope';
import type { ApplicantOutcome } from '../services/api';
import type { TerminalTone } from './SubmittedScreens';

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

const CONTACT_ORG = 'Contact the organisation that sent you this link to find out what happens next.';
const NOTHING_LEFT = 'There is nothing left to do here.';

const VERIFIED: Record<Kind, string> = {
  business: 'This business has been verified.',
  individual: 'Your identity has been verified.',
  address: 'Your address has been verified.',
  'biometric-enrollment': 'Your face has been saved as the reference for your future face checks.',
  questionnaire: 'Your answers have been received.',
  contact: 'Your contact details have been verified.',
};

const NOT_VERIFIED: Record<Kind, string> = {
  business: 'This business could not be verified.',
  individual: 'Your identity could not be verified.',
  address: 'Your address could not be verified.',
  'biometric-enrollment': 'Your face enrolment could not be completed.',
  questionnaire: 'Your answers could not be accepted.',
  contact: 'Your contact details could not be verified.',
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
export function decidedCopy(outcome: ApplicantOutcome, ctx: DecidedContext): DecidedCopy | null {
  switch (outcome) {
    case 'submitted':
      return null;
    case 'action_needed':
      return {
        tone: 'neutral',
        title: 'More information needed',
        description:
          ctx.reason ||
          'Some details need to be provided again. The organisation that sent you this link will have shared a new link to continue.',
      };
    // Ours, not theirs, so it says so rather than reading as a rejection.
    case 'error':
      return {
        tone: 'neutral',
        title: 'Something went wrong on our side',
        description:
          ctx.reason ||
          'This verification could not be completed because of a problem at our end. Nothing was charged. Contact the organisation that sent you this link.',
      };
    case 'approved':
    case 'declined': {
      // A face check's verdict is the in-flow screen's, word for word: the
      // default, the org's own copy, and a declined description that wins over
      // the server's reason, exactly as describeOutcome decides it there.
      if (ctx.scope === 'biometric-authentication') {
        const r = describeOutcome({ kind: 'settled', status: outcome, reason: ctx.reason, reasonCode: null }, ctx.words);
        return { tone: TONE_OF[r.tone], title: r.title, description: r.description };
      }
      const kind: Kind = ctx.scope ?? (ctx.isBusiness ? 'business' : 'individual');
      return outcome === 'approved'
        ? {
            tone: 'success',
            title: kind === 'biometric-enrollment' ? 'Enrolment complete' : 'Verification complete',
            description: ctx.reason || `${VERIFIED[kind]} ${NOTHING_LEFT}`,
          }
        : {
            tone: 'declined',
            title: 'Verification unsuccessful',
            description: ctx.reason || `${NOT_VERIFIED[kind]} ${CONTACT_ORG}`,
          };
    }
  }
}
