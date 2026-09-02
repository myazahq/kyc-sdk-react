import { fillTokens, type CopyTokens } from '../lib/tokens';
import type { SubmitSuccessAction } from './SubmittedScreens';
import type { KYCSuccessContent } from '../types/config';
import type { WorkflowScope } from '../lib/scope';

// The success screen's words and its terminal affordance, in one place.
//
// Two screens render this outcome — the one shown the moment somebody submits,
// and the one shown when they come back to the link afterwards — and a person
// returning must recognise the screen they left. Two copies of this logic is
// exactly how they would stop matching.

export function successTitle(success: KYCSuccessContent | undefined, tokens: CopyTokens): string {
  return success?.title ? fillTokens(success.title, tokens) : 'Verification Submitted!';
}

// Scope-honest defaults: an address-only applicant told "your identity
// verification has been submitted" is being told about a check that never ran.
// Same rule as the consent copy — the default names what was ACTUALLY
// submitted; an org's own success.description always wins.
const SCOPE_DESCRIPTIONS: Partial<Record<WorkflowScope, string>> = {
  address: "Your address verification has been submitted. You'll be notified of the result.",
  'biometric-authentication': "Your face check has been submitted. You'll be notified of the result.",
  'biometric-enrollment': "Your face enrolment has been submitted. You'll be notified of the result.",
  questionnaire: "Your answers have been submitted. You'll be notified of the result.",
  contact: "Your contact verification has been submitted. You'll be notified of the result.",
};

export function successDescription(
  success: KYCSuccessContent | undefined,
  tokens: CopyTokens,
  isBusiness: boolean,
  scope?: WorkflowScope | null,
): string {
  if (success?.description) return fillTokens(success.description, tokens);
  if (scope && SCOPE_DESCRIPTIONS[scope]) return SCOPE_DESCRIPTIONS[scope]!;
  return isBusiness
    ? "Your business verification has been submitted for review. You'll be notified of the result."
    : "Your identity verification has been submitted for review. You'll be notified of the result.";
}

/**
 * Terminal affordance. Embedded mounts: Done → onClose, as ever. Hosted pages
 * have no host surface to close back to, so Done would be dead — navigate to the
 * org's configured completion redirect instead, or end on a "close this tab"
 * note when none is set. The redirect comes from the PUBLISHED config (validated
 * http(s) at publish); the scheme re-check here is defense-in-depth only.
 */
export function successAction(opts: {
  success: KYCSuccessContent | undefined;
  hostedMode: boolean;
  tokens: CopyTokens;
  onClose: () => void;
}): SubmitSuccessAction {
  const redirectUrl = opts.success?.redirectUrl;
  if (!opts.hostedMode) return { label: 'Done', onClick: opts.onClose };
  if (!redirectUrl || !/^https?:\/\//i.test(redirectUrl)) {
    return { note: "You're all set, you can close this tab." };
  }
  // The label is the org's, falling back to "Continue". Tokens are filled the
  // same way the title and description are, so "Back to {businessName}" works.
  // A blank/whitespace label falls back rather than rendering an empty button.
  const label =
    fillTokens(opts.success?.redirectLabel?.trim() || 'Continue', opts.tokens).trim() || 'Continue';
  return { label, onClick: () => window.location.assign(redirectUrl) };
}
