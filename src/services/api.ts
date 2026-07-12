import { SDK_VERSION } from '../utils/device-metadata';

export class KYCApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'KYCApiError';
  }
}

function baseHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'X-SDK-Version': SDK_VERSION,
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  // Some endpoints (e.g. upload confirm) return an empty body. Read as text
  // first so JSON.parse isn't called on "" — that would throw.
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
  if (!res.ok) {
    const errObj = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
    const message = String(errObj.message ?? errObj.error ?? `Request failed with status ${res.status}`);
    const code = typeof errObj.error === 'string' ? errObj.error : undefined;
    throw new KYCApiError(message, res.status, code, errObj);
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Media kinds the SDK can upload. Document/selfie photos plus best-effort videos. */
export type MediaUploadType =
  | 'document_front'
  | 'document_back'
  | 'selfie'
  | 'document_front_video'
  | 'document_back_video'
  | 'liveness_video'
  | 'proof_of_address'
  | 'business_document';

/** Response from `POST /api/kyc/upload` — the stored mediaId. */
export interface UploadResponse {
  mediaId: string;
}

export interface VerifyRequest {
  country: string;
  idType: string;
  idNumber?: string;
  /**
   * Business (KYB) submission block. Present ⇒ this is a business verification.
   * Requires a published KYB workflow (`workflowId` or hosted link); there is
   * no capture, so `mediaIds` is omitted. `idType` carries the product key for
   * transport symmetry.
   */
  business?: {
    registrationNumber: string;
    registrationName?: string;
    product?: string;
    /**
     * Contact email for key-people verification — the server emails this
     * address the invite links when the workflow's `keyPeople.invite.channel`
     * is 'email' and a role needs full KYC. Optional; sent only when non-empty.
     */
    contactEmail?: string;
    /** Company profile (collectCompanyInfo fields) — echoed on the org's
     *  webhook and address-matched against the registry. */
    address?: string;
    email?: string;
    phone?: string;
    website?: string;
    /** Uploaded supporting documents (only honored when the workflow's
     *  `business.documents` block configures them). */
    documents?: Array<{ type: string; mediaId: string }>;
    /** Applicant-declared directors & owners (≤20; `email` drives auto-sent
     *  invites; only honored when the workflow sets `keyPeople.collect`). */
    keyPeople?: Array<{
      name: string;
      role: import('../types/business').KeyPersonRole;
      email?: string;
      /** The person's ISO-2 country — drives their verification link's country. */
      country?: string;
      ownershipPct?: number;
    }>;
    /** The applicant's declared role (+ optional name — the server backfills
     *  it from their verified KYC when absent). */
    applicant?: { role: import('../types/business').ApplicantRole; name?: string };
  };
  /**
   * Attribution: the published flow ("flow_…") that configured this SDK mount.
   * Validated server-side and silently dropped when stale — never fails a
   * submission.
   */
  workflowId?: string;
  /** The org's user reference → Entity.externalUserId at the seam (not matched). */
  userId?: string;
  /**
   * The Presence Intelligence method that ran, so prop-configured mounts bill
   * the right per-method component. A published workflow's livenessMode always
   * wins over this server-side. Absent ⇒ gestures.
   */
  livenessMode?: 'gestures' | 'flash' | 'both';
  deviceIntelligence?: boolean;
  /** What kind of proof-of-address document `mediaIds.proofOfAddress` is. */
  proofOfAddressType?: 'utility_bill' | 'bank_statement' | 'tenancy_agreement' | 'other';
  userData?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  };
  /** Extra-info questionnaire answers, validated server-side against the published definition. */
  questionnaire?: Record<string, string | number | boolean | string[]>;
  /**
   * Contact-verification proof tokens (minted by `POST /contact/check`).
   * Single-use; the server validates + claims them onto the verification —
   * an invalid/expired proof is dropped, a workflow-required missing one 422s.
   */
  contact?: { emailToken?: string; phoneToken?: string };
  /** Captured media references. Omitted for business (KYB) submissions — no capture. */
  mediaIds?: {
    documentFront?: string;
    documentBack?: string;
    selfie?: string;
    documentFrontVideo?: string;
    documentBackVideo?: string;
    livenessVideo?: string;
    proofOfAddress?: string;
  };
  metadata: {
    requestId: string;
    device?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export interface VerifyResponse {
  verificationId: string;
  status: 'pending';
  /**
   * Business submissions only: the KeyPerson id minted for the applicant when
   * the workflow requires applicant verification. The SDK immediately submits
   * the applicant's own INDIVIDUAL verification with
   * `metadata.userId = applicantKeyPersonId` so the server links it back.
   */
  applicantKeyPersonId?: string | null;
  /** Business submissions only: copyable verification links for the key people
   *  the applicant listed — shown on the success screen to send on. */
  keyPeopleInvites?: Array<{ keyPersonId: string; name: string; inviteUrl: string }>;
}

/**
 * Minimal, publishable-safe status from `GET /api/kyc/status/:id`.
 *
 * Because this is reachable with the publishable (`pk_`) key the SDK carries, it
 * intentionally contains NO PII, match scores, or result data — only the
 * lifecycle state and (on non-success) the org-safe failure reason. To read the
 * full result + extracted biodata, call `GET /api/kyc/verifications/:id` from
 * your backend with a SECRET (`sk_`) key — never ship a secret key in the SDK.
 */
export interface VerificationStatusResponse {
  verificationId: string;
  status: 'pending' | 'verified' | 'failed' | 'not_found' | 'error';
  reason?: string | null;
  reasonCode?: string | null;
  /**
   * How the identity was (or will be) established, on pending/verified rows:
   * `'chip'` (NFC eMRTD read), `'gov_db'` (government-database lookup), or
   * `'document'` (Document Intelligence — OCR + selfie↔document-portrait
   * facial compare; the Global Documents path).
   */
  assuranceLevel?: 'chip' | 'gov_db' | 'document';
  createdAt: string;
  completedAt?: string;
}

export interface SdkConfigIdType {
  country: string;
  idType: string;
  /** Display name (e.g. "International Passport") — the source of truth for
   *  pairs the SDK has no local definition for (Global Documents). */
  label?: string;
  /** false = number-only ID (the user types the number, no document scan). */
  requiresDocumentCapture?: boolean;
  /** How many document sides to scan (document-capture IDs). */
  scanSides?: 'front_only' | 'front_and_back';
  /** Whether the document carries an NFC-readable chip (native SDKs only). */
  supportsNfc?: boolean;
  features: {
    documentVerification: boolean;
    livenessCheck: boolean;
    govDbCheck: boolean;
  };
}

/** Org branding configured server-side, returned with the SDK config. */
export interface SdkConfigBranding {
  /** Public URL of the org's logo, if one is configured. */
  logo?: string;
  /** Org display name. */
  companyName?: string;
  /** Org brand color (hex). */
  primaryColor?: string;
}

export interface SdkConfigResponse {
  environment: 'DEVELOPMENT' | 'SANDBOX' | 'PRODUCTION';
  idTypes: SdkConfigIdType[];
  /**
   * Org branding (logo, name, color). Surfaced so the SDK can render the org's
   * own logo when the consumer sets `appearance.logo = 'default'`.
   */
  branding?: SdkConfigBranding;
}

// ---------------------------------------------------------------------------
// Verification Flows (dashboard-built SDK configuration templates)
// ---------------------------------------------------------------------------

/**
 * The serialized template config a published flow carries — the same shape a
 * handoff `configSnapshot` uses, minus the runtime fields (userId/userData/
 * metadata), which always come from the consumer's code.
 */
export interface WorkflowConfigPayload {
  /**
   * What the workflow verifies. Absent = 'individual'. Business (KYB)
   * workflows use the `business` block below instead of country/idTypes.
   */
  subjectType?: 'individual' | 'business';
  /** Business (KYB) configuration — present when `subjectType === 'business'`. */
  business?: {
    /** ISO-2 registry country (NOT limited to the individual catalogue). */
    country: string;
    /** Offered product keys (absent = ['business']). */
    products?: string[];
    requireRegistrationName?: boolean;
    /** Key-people (director/owner) verification configuration. */
    keyPeople?: import('../types/business').WorkflowKeyPeopleConfig;
    /** Supporting-document collection configuration. */
    documents?: import('../types/business').WorkflowBusinessDocumentsConfig;
    /** Applicant (submitter) identity verification configuration. */
    applicant?: import('../types/business').WorkflowBusinessApplicantConfig;
  };
  /** Absent for business workflows — the business block carries its own country. */
  country?: string;
  /** Multi-region: per-country ID types (validation toggles are server-enforced). */
  countries?: Array<{ country: string; idTypes?: string[] }>;
  idTypes?: string[];
  enableSelfie?: boolean;
  enableDocumentCapture?: boolean;
  allowDocumentUpload?: boolean;
  enableLiveness?: boolean;
  /** Presence Intelligence method: gestures (default) | flash | both. */
  livenessMode?: string;
  /** "Continue on your phone" desktop QR gate. On by default; false disables it. */
  deviceHandoff?: boolean;
  voiceGuidance?: unknown;
  showThemeToggle?: boolean;
  fullScreen?: boolean;
  disableClose?: boolean;
  appearance?: Record<string, unknown>;
  consent?: Record<string, unknown>;
  success?: Record<string, unknown>;
  /** Contact verification step configurations (email/phone OTP). */
  emailVerification?: { enabled?: boolean; required?: boolean; codeLength?: number; maxAttempts?: number; inputStyle?: 'segmented' | 'text' };
  phoneVerification?: {
    enabled?: boolean;
    required?: boolean;
    codeLength?: number;
    maxAttempts?: number;
    inputStyle?: 'segmented' | 'text';
    channels?: Array<'sms' | 'whatsapp'>;
    defaultCountry?: string;
  };
  /** Extra-info questionnaire definition (compliance declarations). */
  questionnaire?: { title?: string; description?: string; fields: unknown[] };
  /** Proof of Address step configuration. */
  proofOfAddress?: { enabled?: boolean; documentTypes?: string[]; maxAgeDays?: number };
  /** NFC chip verification configuration (native SDKs; web = preview only). */
  nfc?: { enabled?: boolean; idTypes?: string[]; allowSkip?: boolean };
  assetsBasePath?: string;
}

/** Response from `GET /api/kyc/workflows/:workflowId` — one round trip hydrates the SDK. */
export interface WorkflowResolutionResponse {
  flow: { id: string; name: string; version: number };
  config: WorkflowConfigPayload;
  environment: 'DEVELOPMENT' | 'SANDBOX' | 'PRODUCTION';
  /** Org allowlist + per-ID feature flags (same shape as /config). */
  idTypes: SdkConfigIdType[];
  branding?: SdkConfigBranding;
}

// ---------------------------------------------------------------------------
// Device handoff (continue-on-phone)
// ---------------------------------------------------------------------------

/**
 * Snapshot of the consumer's config the desktop sends to mint a handoff
 * session. The phone re-renders the same flow from it. `userData` is included
 * so the greeting and consent tokens work on the phone — the token URL is
 * already the secret, so the risk profile is the same as a magic link.
 */
export interface HandoffSessionSnapshot {
  /** Absent for business (KYB) sessions — `business.country` carries theirs. */
  country?: string;
  /** What the session verifies. Absent = 'individual'. */
  subjectType?: 'individual' | 'business';
  /** Business (KYB) configuration — present when `subjectType === 'business'`. */
  business?: {
    country: string;
    products?: string[];
    requireRegistrationName?: boolean;
    keyPeople?: import('../types/business').WorkflowKeyPeopleConfig;
    documents?: import('../types/business').WorkflowBusinessDocumentsConfig;
    applicant?: import('../types/business').WorkflowBusinessApplicantConfig;
  };
  /**
   * Attribution ride-along when the desktop SDK was configured by a published
   * flow — the server validates it and stamps it on the session (it is NOT
   * part of the rendered config).
   */
  workflowId?: string;
  /** Multi-region configuration (per-country ID types). */
  countries?: Array<{ country: string; idTypes?: string[] }>;
  idTypes?: string[];
  enableSelfie?: boolean;
  enableDocumentCapture?: boolean;
  allowDocumentUpload?: boolean;
  enableLiveness?: boolean;
  /** Presence Intelligence method: gestures (default) | flash | both. */
  livenessMode?: string;
  /** "Continue on your phone" desktop QR gate. On by default; false disables it. */
  deviceHandoff?: boolean;
  voiceGuidance?: unknown;
  showThemeToggle?: boolean;
  fullScreen?: boolean;
  disableClose?: boolean;
  appearance?: Record<string, unknown>;
  consent?: Record<string, unknown>;
  success?: Record<string, unknown>;
  /** Contact verification step configurations (email/phone OTP). */
  emailVerification?: { enabled?: boolean; required?: boolean; codeLength?: number; maxAttempts?: number; inputStyle?: 'segmented' | 'text' };
  phoneVerification?: {
    enabled?: boolean;
    required?: boolean;
    codeLength?: number;
    maxAttempts?: number;
    inputStyle?: 'segmented' | 'text';
    channels?: Array<'sms' | 'whatsapp'>;
    defaultCountry?: string;
  };
  /** Extra-info questionnaire definition (compliance declarations). */
  questionnaire?: { title?: string; description?: string; fields: unknown[] };
  /** Proof of Address step configuration. */
  proofOfAddress?: { enabled?: boolean; documentTypes?: string[]; maxAgeDays?: number };
  /** NFC chip verification configuration (native SDKs; web = preview only). */
  nfc?: { enabled?: boolean; idTypes?: string[]; allowSkip?: boolean };
  metadata?: Record<string, string>;
  /** Opaque org user reference — rides the snapshot like metadata (not PII). */
  userId?: string;
  userData?: { firstName?: string; lastName?: string; dateOfBirth?: string };
  assetsBasePath?: string;
}

/** Response from `POST /api/kyc/session`. */
export interface CreateHandoffSessionResponse {
  sessionId: string;
  /** Human-typable / copyable short code (display only). */
  code: string;
  /** Full hosted-page URL the QR encodes. */
  url: string;
  expiresAt: string;
}

export type HandoffSessionStatus = 'pending' | 'opened' | 'submitted' | 'expired';

/** Response from `GET /api/kyc/session/:sessionId` (desktop poll, no PII). */
export interface HandoffSessionStatusResponse {
  status: HandoffSessionStatus;
  verificationId?: string;
  verificationStatus?: VerificationStatusResponse['status'];
}

/** Response from `GET /api/kyc/session/by-token/:token/bootstrap` (phone side). */
export interface HandoffBootstrapResponse {
  environment: 'DEVELOPMENT' | 'SANDBOX' | 'PRODUCTION';
  configSnapshot: HandoffSessionSnapshot;
  branding?: SdkConfigBranding;
  /** Org allowlist + per-ID feature flags (same shape as /config). */
  idTypes: SdkConfigIdType[];
  expiresAt: string;
}

// The mimeType values the server accepts (image vs. video). Must mirror the
// server's upload allowlist exactly.
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const VIDEO_MIME_TYPES = ['video/webm', 'video/mp4'] as const;

// Drop codec params from a blob's type (e.g. "video/webm;codecs=vp9" ->
// "video/webm") and fall back to a sane default per media kind when the value
// isn't one the server recognizes.
function normalizeMimeType(blobType: string, type: MediaUploadType): string {
  const base = (blobType.split(';')[0] || '').trim().toLowerCase();
  const isVideo = type.endsWith('_video');
  // Proof-of-address + business documents may be PDFs (statements, certificates).
  if ((type === 'proof_of_address' || type === 'business_document') && base === 'application/pdf') return base;
  const allowed: readonly string[] = isVideo ? VIDEO_MIME_TYPES : IMAGE_MIME_TYPES;
  if (allowed.includes(base)) return base;
  return isVideo ? 'video/webm' : 'image/jpeg';
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/webm': 'webm',
  'video/mp4': 'mp4',
  'application/pdf': 'pdf',
};

// Wrap the blob as a named File with a clean mimeType so the multipart part
// carries a Content-Type the server recognizes (a bare Blob is sent as "blob"
// with whatever raw type it had, codec params and all).
function toUploadFile(file: Blob, type: MediaUploadType): File {
  const mimeType = normalizeMimeType(file.type, type);
  return new File([file], `${type}.${MIME_EXTENSIONS[mimeType]}`, { type: mimeType });
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createKYCApi(baseUrl: string, apiKey: string) {
  const base = `${baseUrl}/api/kyc`;
  const headers = baseHeaders(apiKey);

  // JSON request to our own server (verify, status, config). Adds the
  // Authorization + X-SDK-Version headers and a JSON content type when a body
  // is present.
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        ...headers,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
    return handleResponse<T>(res);
  }

  return {
    // Single multipart upload: the file bytes are POSTed to our server, which
    // stores them in R2 and returns the mediaId referenced later by /verify.
    async upload(file: Blob, type: MediaUploadType): Promise<string> {
      const form = new FormData();
      // Send a named File with a normalized mimeType (codec params stripped) so
      // the multipart part's Content-Type matches the server's allowlist.
      form.append('file', toUploadFile(file, type));
      form.append('type', type);

      // Don't set Content-Type — the browser adds the multipart boundary itself.
      const res = await fetch(`${base}/upload`, {
        method: 'POST',
        headers,
        body: form,
      });
      const { mediaId } = await handleResponse<UploadResponse>(res);
      return mediaId;
    },

    async verify(body: VerifyRequest): Promise<VerifyResponse> {
      return request<VerifyResponse>('/verify', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },

    // ── Contact verification (email/phone OTP) ──────────────────────────────

    /** Send an OTP to an email address or phone number. */
    async contactSend(body: {
      channel: 'email' | 'phone';
      destination: string;
      /** ISO-2 default country for national phone formats (the flow's country). */
      country?: string;
      /** Phone delivery channel preference (default sms). */
      via?: 'sms' | 'whatsapp';
      /** Org-configured code length (server clamps 4–8). */
      codeLength?: number;
      /** Org-configured attempt budget (server clamps 1–5). */
      maxAttempts?: number;
    }): Promise<{ challengeId: string; expiresAt: string; deliveryChannel: string }> {
      return request('/contact/send', { method: 'POST', body: JSON.stringify(body) });
    },

    /** Check the typed code — returns the single-use proof token for /verify. */
    async contactCheck(body: {
      challengeId: string;
      code: string;
    }): Promise<{ verified: boolean; token: string }> {
      return request('/contact/check', { method: 'POST', body: JSON.stringify(body) });
    },

    // Minimal, publishable-safe status (no PII). The full result lives behind a
    // secret-key-only endpoint and must be fetched from your backend.
    async status(verificationId: string): Promise<VerificationStatusResponse> {
      return request<VerificationStatusResponse>(`/status/${verificationId}`);
    },

    async config(): Promise<SdkConfigResponse> {
      return request<SdkConfigResponse>('/config');
    },

    /**
     * Resolve a published Workflow (dashboard-built configuration + decisioning template).
     * 404s when the flow is unknown to this key's org/environment or not
     * published.
     */
    async workflow(workflowId: string): Promise<WorkflowResolutionResponse> {
      return request<WorkflowResolutionResponse>(`/workflows/${encodeURIComponent(workflowId)}`);
    },

    // ── Device handoff (continue-on-phone) ──────────────────────────────────

    /** Desktop: mint a handoff session from a PII-free config snapshot. */
    async createHandoffSession(snapshot: HandoffSessionSnapshot): Promise<CreateHandoffSessionResponse> {
      return request<CreateHandoffSessionResponse>('/session', {
        method: 'POST',
        body: JSON.stringify(snapshot),
      });
    },

    /** Desktop: poll a handoff session's lifecycle status. */
    async getHandoffSession(sessionId: string): Promise<HandoffSessionStatusResponse> {
      return request<HandoffSessionStatusResponse>(`/session/${sessionId}`);
    },

    /** Phone: bootstrap the hosted flow from the session token (public route). */
    async bootstrapHandoff(token: string): Promise<HandoffBootstrapResponse> {
      return request<HandoffBootstrapResponse>(`/session/by-token/${token}/bootstrap`);
    },
  };
}

export type KYCApi = ReturnType<typeof createKYCApi>;
