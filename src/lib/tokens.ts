// ---------------------------------------------------------------------------
// Copy personalization tokens for the consent + success screen overrides.
// Shared by ConsentStep and SubmittedStep so the supported token set can never
// drift between the two screens.
// ---------------------------------------------------------------------------

/**
 * Values used to fill `{token}` placeholders in consent/success copy. Any
 * absent value resolves to an empty string.
 *
 * - `{firstName}` / `{lastName}` — from `userData` (individual flows).
 * - `{businessName}` — the business being verified (KYB flows). On the success
 *   screen this comes from the registration name the applicant entered; on the
 *   consent screen (before any business details are collected) it only resolves
 *   when the integrator passes it in via `userData.businessName`.
 */
export interface CopyTokens {
  firstName?: string;
  lastName?: string;
  businessName?: string;
}

/** Replaces `{firstName}` / `{lastName}` / `{businessName}` tokens (or ''). */
export function fillTokens(template: string, tokens: CopyTokens = {}): string {
  return template
    .replace(/\{firstName\}/g, tokens.firstName ?? '')
    .replace(/\{lastName\}/g, tokens.lastName ?? '')
    .replace(/\{businessName\}/g, tokens.businessName ?? '')
    .trim();
}
