import type { KYCState } from '../context/types';
import { getStepLog } from './step-log';
import { multiIdWireSlots } from './multi-id';

/**
 * The slice of flow state worth carrying between visits.
 *
 * Deliberately EXCLUDES the base64 previews (`documentFrontImage`, `selfieImage`)
 * and the video blobs. Those are display artefacts and raw bytes: they would bloat
 * the payload enormously, and the `mediaId` beside them is already the durable
 * reference the server verifies against. On resume a slot with a mediaId counts as
 * captured even though its thumbnail is gone.
 */
export interface SessionProgressPayload {
  step?: string;
  /**
   * The journey so far, not just where they are now.
   *
   * The same log that rides the submission, saved as they move so the
   * dashboard timeline fills in live rather than appearing all at once at the
   * end — which is no use at all while somebody is stuck.
   */
  stepLog?: { steps: { step: string; at: string }[]; sentAt: string } | null;
  mediaIds?: Record<string, string>;
  data?: {
    selectedCountry?: unknown;
    selectedIdType?: unknown;
    /** Multi-ID: which slot the attempt was on + the evidence already committed. */
    multiIdSlotIndex?: number;
    multiIdSlots?: unknown;
    idNumber?: string;
    userData?: unknown;
    business?: unknown;
    businessApplication?: unknown;
    contact?: unknown;
    questionnaireAnswers?: unknown;
  };
}

/** Build the payload from current flow state. */
export function progressFromState(state: KYCState): SessionProgressPayload {
  const mediaIds = Object.fromEntries(
    Object.entries(state.mediaIds ?? {}).filter(([, v]) => typeof v === 'string' && v),
  ) as Record<string, string>;

  return {
    step: state.currentStep,
    stepLog: getStepLog(),
    mediaIds,
    data: {
      selectedCountry: state.selectedCountry ?? undefined,
      selectedIdType: state.selectedIdType ?? undefined,
      multiIdSlotIndex: state.multiIdSlotIndex > 0 ? state.multiIdSlotIndex : undefined,
      multiIdSlots:
        state.multiIdSlots.length > 0 ? multiIdWireSlots(state.multiIdSlots) : undefined,
      idNumber: state.idNumber || undefined,
      userData: state.userData,
      business: state.business,
      businessApplication: state.businessApplication,
      contact: state.contact,
      questionnaireAnswers: state.questionnaireAnswers,
    },
  };
}

/**
 * Has the applicant actually begun, or is this just the flow as it opened?
 *
 * Nothing here needs saving until they move: an untouched payload restores to
 * the screen they are already on. Not writing it is also what lets the server
 * tell a link somebody opened and abandoned on the first screen from one they
 * worked through — the presence of stored progress IS "they started", and a
 * save-on-mount made every opened link look started.
 *
 * `consent` is the first step of both flows unconditionally (see step-order.ts),
 * so it is a safe universal marker. Everything else errs towards saving.
 */
export function isUntouchedProgress(payload: SessionProgressPayload): boolean {
  if (payload.step && payload.step !== 'consent') return false;
  if (Object.keys(payload.mediaIds ?? {}).length > 0) return false;
  const d = payload.data;
  if (!d) return true;
  return !d.selectedCountry && !d.selectedIdType && !d.idNumber;
}

/**
 * Stable key for "has anything worth saving changed?", so idle re-renders don't
 * put the same payload back to the server over and over.
 */
export function progressFingerprint(payload: SessionProgressPayload): string {
  return JSON.stringify(payload);
}
