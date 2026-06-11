import type { KYCStep, IdType } from '../types/config';
import type { ApiStatus, KYCError } from '../types/verification';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface KYCUserData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

export interface MediaIds {
  documentFront?: string;
  documentBack?: string;
  selfie?: string;
  documentFrontVideo?: string;
  documentBackVideo?: string;
  livenessVideo?: string;
}

export interface KYCState {
  currentStep: KYCStep;
  status: ApiStatus;
  isOpen: boolean;

  // Step 2 – ID type selection
  selectedIdType: IdType | null;

  // Step 3 – Document capture (base64 previews for display only)
  documentFrontImage: string | null;
  documentBackImage: string | null;

  // Media IDs returned by the server after each upload
  mediaIds: MediaIds;

  // Step 3b – ID input (number-only IDs)
  idNumber: string;
  userData: KYCUserData;

  // Step 4 – Liveness / selfie
  selfieImage: string | null;

  // Video blobs captured during document and liveness steps
  documentFrontVideoBlob: Blob | null;
  documentBackVideoBlob: Blob | null;
  livenessVideoBlob: Blob | null;

  // Step 5 – Submission result
  verificationId: string | null;
  /**
   * Last technical error (submission failures). Carries the typed `code` so the
   * consumer's `onError` receives a `KYCError`, not a bare string. Capture-step
   * errors (camera permission, upload-after-retries) report to `onError`
   * directly and do not set this — they have their own inline UI.
   */
  error: KYCError | null;
}

// ---------------------------------------------------------------------------
// Actions (discriminated union)
// ---------------------------------------------------------------------------

export type KYCAction =
  | { type: 'OPEN_MODAL' }
  | { type: 'CLOSE_MODAL' }
  | { type: 'SET_STEP'; payload: KYCStep }
  | { type: 'SELECT_ID_TYPE'; payload: IdType }
  | { type: 'SET_ID_NUMBER'; payload: string }
  | { type: 'SET_USER_DATA'; payload: Partial<KYCUserData> }
  // Document capture
  | { type: 'SET_DOCUMENT_FRONT'; payload: string }
  | { type: 'SET_DOCUMENT_BACK'; payload: string }
  | { type: 'CLEAR_DOCUMENT_FRONT' }
  | { type: 'CLEAR_DOCUMENT_BACK' }
  | { type: 'CLEAR_DOCUMENT_ALL' }
  // Media IDs (set after each upload completes)
  | { type: 'SET_MEDIA_ID'; payload: { mediaType: keyof MediaIds; mediaId: string } }
  | { type: 'CLEAR_MEDIA_IDS' }
  // Selfie
  | { type: 'SET_SELFIE_IMAGE'; payload: string }
  | { type: 'CLEAR_SELFIE_IMAGE' }
  // Video blobs
  | { type: 'SET_DOCUMENT_FRONT_VIDEO'; payload: Blob }
  | { type: 'SET_DOCUMENT_BACK_VIDEO'; payload: Blob }
  | { type: 'SET_LIVENESS_VIDEO'; payload: Blob }
  | { type: 'CLEAR_LIVENESS_VIDEO' }
  // Submission
  | { type: 'SUBMIT_VERIFICATION' }
  | { type: 'SUBMISSION_SUCCESS'; payload: string }
  | { type: 'SET_ERROR'; payload: KYCError }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RETRY' }
  | { type: 'RESET' };
