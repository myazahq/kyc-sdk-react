// ---------------------------------------------------------------------------
// Submission callback payload (returned to onSubmit)
// ---------------------------------------------------------------------------

export interface KYCSubmission {
  verificationId: string;
  status: 'pending';
  metadata: Record<string, string>;
  submittedAt: string;
}

// ---------------------------------------------------------------------------
// Technical error types (onError callback)
// ---------------------------------------------------------------------------

export type KYCErrorCode =
  | 'network_error'
  | 'invalid_api_key'
  | 'insufficient_credits'
  | 'upload_failed'
  | 'unknown';

export interface KYCError {
  code: KYCErrorCode;
  message: string;
  details?: {
    required?: number;
    balance?: number;
    currency?: string;
  };
}

// ---------------------------------------------------------------------------
// API call status (used by hooks / reducer)
// ---------------------------------------------------------------------------

export type ApiStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
}
