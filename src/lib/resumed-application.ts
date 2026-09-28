// A KYB application whose BUSINESS half already committed, resumed before the
// applicant's own verification went through.
//
// The business submission claims the session: from then on the session is
// SUBMITTED, and the server refuses a NEW business submission on it
// ("Start or resume this business verification session before submitting").
// That is what an applicant met after their phone died between the two legs:
// on reopening, the restored flow landed on the submitting screen, which sent
// the business again under a fresh request id, and was refused.
//
// The server hands back what it needs to recover instead (session start and
// the hosted bootstrap): the parent's own request id, so the submitting screen
// REPLAYS the business submission. An exact replay is answered from the row
// that already exists, with the applicant KeyPerson id, and the applicant leg
// then goes through as it would have.

export interface ResumedApplication {
  /** The committed business verification. */
  verificationId: string;
  /** The applicant KeyPerson still waiting on their own verification. */
  applicantKeyPersonId: string;
  /** The business submission's own request id, replayed as-is. */
  requestId: string;
}

/** PURE. The resumed application a start/bootstrap response names, else null. */
export function resumedApplicationFrom(response: {
  applicantKeyPersonId?: unknown;
  parentVerificationId?: unknown;
  parentRequestId?: unknown;
}): ResumedApplication | null {
  const { applicantKeyPersonId, parentVerificationId, parentRequestId } = response;
  if (
    typeof applicantKeyPersonId !== 'string' || applicantKeyPersonId === '' ||
    typeof parentVerificationId !== 'string' || parentVerificationId === '' ||
    typeof parentRequestId !== 'string' || parentRequestId === ''
  ) {
    return null;
  }
  return { verificationId: parentVerificationId, applicantKeyPersonId, requestId: parentRequestId };
}

/**
 * PURE. The request id a submission goes out under: a business flow resuming a
 * committed application replays the parent's; everything else is new.
 */
export function submissionRequestId(
  business: boolean,
  resumed: ResumedApplication | null,
  fresh: () => string,
): string {
  return business && resumed ? resumed.requestId : fresh();
}
