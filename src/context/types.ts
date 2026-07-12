import type { KYCStep, AnyIdType, AnyCountry, QuestionnaireAnswerValue, PoaDocumentType } from '../types/config';
import type { ApiStatus, KYCError } from '../types/verification';
import type { ApplicantRole, BusinessDocumentKey, KeyPersonRole } from '../types/business';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface KYCUserData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

export interface BusinessDetails {
  /** Chosen registry country; null until picked (single-country flows resolve at submit). */
  country: string | null;
  /** Chosen verification product; null until picked (single-product flows resolve at submit). */
  product: string | null;
  registrationNumber: string;
  registrationName: string;
  /** Optional contact email for key-people (owner) verification invites. */
  contactEmail: string;
  // Company profile (collectCompanyInfo — default on): all optional inputs.
  address: string;
  email: string;
  phone: string;
  website: string;
}

/** One row on the business-key-people step. Inputs kept as strings for
 *  controlled fields; the submit payload builder parses/filters them. */
export interface KeyPersonEntry {
  name: string;
  role: KeyPersonRole;
  email: string;
  /** ISO-2 country of the person (drives their verification link's country). */
  country: string;
  /** Ownership percentage as typed (optional; validated 0–100 when present). */
  ownershipPct: string;
}

/** One uploaded slot on the business-documents step. */
export interface BusinessDocumentUpload {
  type: BusinessDocumentKey;
  mediaId: string;
  fileName: string;
}

/** The KYB APPLICATION extras collected beyond the registration details. */
export interface BusinessApplicationState {
  keyPeople: KeyPersonEntry[];
  documents: BusinessDocumentUpload[];
  applicantRole: ApplicantRole | null;
  applicantName: string;
}

export interface MediaIds {
  documentFront?: string;
  documentBack?: string;
  selfie?: string;
  documentFrontVideo?: string;
  documentBackVideo?: string;
  livenessVideo?: string;
  proofOfAddress?: string;
}

export interface KYCState {
  currentStep: KYCStep;
  status: ApiStatus;
  isOpen: boolean;

  // Step 1b – country selection (multi-region flows; null = use config default)
  selectedCountry: AnyCountry | null;

  // Step 2 – ID type selection
  selectedIdType: AnyIdType | null;

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

  // Step 2b — business (KYB) workflow details (replaces id-type/capture steps)
  business: BusinessDetails;

  // Steps 2c/2d/2e — KYB application extras (key people, documents, applicant)
  businessApplication: BusinessApplicationState;

  // Steps 1b/1c — contact verification (email/phone OTP). The proof tokens are
  // single-use server mints submitted with /verify; destinations are kept for
  // display ("Verified a***@gmail.com").
  contact: {
    emailToken: string | null;
    emailAddress: string | null;
    phoneToken: string | null;
    phoneNumber: string | null;
  };

  // Step 4b — extra-info questionnaire answers, keyed by question key
  questionnaireAnswers: Record<string, QuestionnaireAnswerValue>;

  // Step 4c — proof of address (mediaId lives in mediaIds.proofOfAddress)
  poaDocumentType: PoaDocumentType | null;
  poaFileName: string | null;

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
  | { type: 'SET_COUNTRY'; payload: AnyCountry }
  | { type: 'SELECT_ID_TYPE'; payload: AnyIdType }
  | { type: 'SET_ID_NUMBER'; payload: string }
  | { type: 'SET_USER_DATA'; payload: Partial<KYCUserData> }
  // Business (KYB) details
  | { type: 'SET_BUSINESS_DETAILS'; payload: Partial<BusinessDetails> }
  // KYB application extras (key people / documents / applicant role+name)
  | { type: 'SET_BUSINESS_APPLICATION'; payload: Partial<BusinessApplicationState> }
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
  // Contact verification (email/phone OTP proof)
  | { type: 'SET_CONTACT_PROOF'; payload: { channel: 'email' | 'phone'; token: string; destination: string } }
  // Questionnaire
  | { type: 'SET_QUESTIONNAIRE_ANSWER'; payload: { key: string; value: QuestionnaireAnswerValue | undefined } }
  // Proof of Address
  | { type: 'SET_POA_DOCUMENT'; payload: { documentType: PoaDocumentType; fileName: string } }
  | { type: 'CLEAR_POA_DOCUMENT' }
  // Submission
  | { type: 'SUBMIT_VERIFICATION' }
  | { type: 'SUBMISSION_SUCCESS'; payload: string }
  | { type: 'SET_ERROR'; payload: KYCError }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RETRY' }
  | { type: 'RESET' };
