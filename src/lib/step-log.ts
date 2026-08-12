// Session step log — records each SDK step the user reaches, with a
// timestamp, so the server can reconstruct the journey on the verification
// timeline ("consent opened → ID type chosen → document captured → …").
// Rides the verify submission as metadata.device.stepLog — the same free-form
// channel the Device Intelligence fingerprint uses: no extra network calls,
// no new endpoint, and old SDKs simply never send it. `sentAt` is stamped at
// collect time so the server can correct client-clock skew against its own
// receipt time. Step names only — never PII.

export interface StepLogEntry {
  step: string;
  at: string;
}

export interface StepLog {
  steps: StepLogEntry[];
  sentAt: string;
}

const MAX_ENTRIES = 40;

let entries: StepLogEntry[] = [];

/** Fresh slate per session (called where integrity signals reset — modal open). */
export function resetStepLog(): void {
  entries = [];
}

/** Records a step visit. Consecutive duplicates are collapsed; back-and-forth
 *  navigation is kept — repeat visits are honest journey data. */
export function recordStep(step: string): void {
  if (entries.length >= MAX_ENTRIES) return;
  if (entries[entries.length - 1]?.step === step) return;
  entries.push({ step, at: new Date().toISOString() });
}

/** Snapshot attached to the verify submission. Null when nothing was recorded
 *  (e.g. a headless/server caller) so the field is simply absent. */
export function getStepLog(): StepLog | null {
  if (entries.length === 0) return null;
  return { steps: [...entries], sentAt: new Date().toISOString() };
}
