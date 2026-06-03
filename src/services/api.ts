const SDK_VERSION = '1.0.1';

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
  | 'liveness_video';

/** Response from `POST /api/kyc/upload` — the stored mediaId. */
export interface UploadResponse {
  mediaId: string;
}

export interface VerifyRequest {
  country: string;
  idType: string;
  idNumber?: string;
  userData?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  };
  mediaIds: {
    documentFront?: string;
    documentBack?: string;
    selfie?: string;
    documentFrontVideo?: string;
    documentBackVideo?: string;
    livenessVideo?: string;
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
}

export interface VerificationStatusResponse {
  verificationId: string;
  status: 'pending' | 'verified' | 'failed' | 'not_found' | 'error';
  result?: Record<string, unknown>;
  createdAt: string;
}

export interface SdkConfigIdType {
  country: string;
  idType: string;
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
  environment: 'STAGING' | 'PRODUCTION';
  idTypes: SdkConfigIdType[];
  /**
   * Org branding (logo, name, color). Surfaced so the SDK can render the org's
   * own logo when the consumer sets `appearance.logo = 'default'`.
   */
  branding?: SdkConfigBranding;
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

    async status(verificationId: string): Promise<VerificationStatusResponse> {
      return request<VerificationStatusResponse>(`/status/${verificationId}`);
    },

    async config(): Promise<SdkConfigResponse> {
      return request<SdkConfigResponse>('/config');
    },
  };
}

export type KYCApi = ReturnType<typeof createKYCApi>;
