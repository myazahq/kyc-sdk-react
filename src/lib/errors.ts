// ---------------------------------------------------------------------------
// mapToKycError — turn a raw network/API error into a typed KYCError
//
// Used at every call site that talks to the server (upload, verify) so the
// `onError` callback always receives a documented, typed `code`. Mirrors the
// Flutter SDK's `_mapToKycError` so the two platforms surface the same codes.
// ---------------------------------------------------------------------------

import { KYCApiError } from '../services/api';
import { KYCError, type KYCErrorCode } from '../types/verification';
import { BUSINESS_DOCUMENT_LABELS } from './business-application';
import type { BusinessDocumentKey } from '../types/business';

/** Which operation failed — picks the fallback code for non-HTTP failures. */
export type ErrorContext = 'upload' | 'verify';

/**
 * Invokes the consumer's `onError` handler defensively. A handler that throws
 * (e.g. a logging call that trips a dev tool) must never crash the SDK flow —
 * onError often runs inside an effect, where a throw would otherwise bubble to
 * the error boundary. Swallows the throw and warns instead.
 */
export function safeReportError(
  onError: ((error: KYCError) => void) | undefined,
  error: KYCError,
): void {
  if (!onError) return;
  try {
    onError(error);
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[MyazaKYC] onError handler threw and was ignored:', err);
    }
  }
}

function toNum(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

/**
 * Server error codes with dedicated user-facing messages, keyed by the body's
 * `error` token. Mostly the business (KYB) submission path — checked before
 * the generic status-code branches so e.g. a 500 `pricing_not_configured`
 * doesn't read as a transient server blip.
 */
const CODED_ERRORS: Record<string, { code: KYCErrorCode; message: string }> = {
  workflow_not_found: {
    code: 'invalid_workflow',
    message: 'This verification workflow is unavailable. It may have been unpublished — please reload and try again.',
  },
  workflow_subject_mismatch: {
    code: 'invalid_workflow',
    message: 'This workflow cannot accept a business submission. Contact the organization that sent you here.',
  },
  business_verifications_disabled: {
    code: 'feature_disabled',
    message: 'Business verification is not enabled for this organization. Contact your administrator to request access.',
  },
  country_mismatch: {
    code: 'invalid_workflow',
    message: "The submitted country doesn't match this workflow's configuration. Please reload and try again.",
  },
  product_unsupported: {
    code: 'invalid_workflow',
    message: 'The selected verification product is not offered by this workflow. Please reload and try again.',
  },
  registration_name_required: {
    code: 'unknown',
    message: 'Please enter the registered business name to continue.',
  },
  only_test_ids_allowed: {
    code: 'unknown',
    message: 'Sandbox mode accepts only published test registration numbers (e.g. RC0000001 or RC0000002).',
  },
  pricing_not_configured: {
    code: 'unknown',
    message: 'Verification pricing has not been configured for this organization. Please contact support.',
  },
};

/**
 * Maps an unknown error thrown by the API client to a typed {@link KYCError}
 * with a user-facing message. `context` selects the fallback code when the
 * failure isn't a specific HTTP status (e.g. a bare network failure during an
 * upload becomes `upload_failed`, during verify becomes `network_error`).
 */
export function mapToKycError(err: unknown, context: ErrorContext): KYCError {
  if (err instanceof KYCApiError) {
    // 422 missing_documents carries the missing doc keys — name them so the
    // user knows exactly which required business documents to go back for.
    if (err.code === 'missing_documents') {
      const missing = Array.isArray(err.body?.missing) ? (err.body.missing as string[]) : [];
      const labels = missing.map(
        (key) => BUSINESS_DOCUMENT_LABELS[key as BusinessDocumentKey] ?? key,
      );
      return new KYCError(
        'unknown',
        labels.length > 0
          ? `Required business documents are missing: ${labels.join(', ')}. Please go back and upload them.`
          : 'Some required business documents are missing. Please go back and upload them.',
      );
    }
    const coded = err.code ? CODED_ERRORS[err.code] : undefined;
    if (coded) {
      return new KYCError(coded.code, coded.message);
    }
    if (err.statusCode === 401) {
      return new KYCError('invalid_api_key', 'Invalid API key. Please contact support.');
    }
    if (err.statusCode === 402) {
      const body = err.body ?? {};
      const required = toNum(body.required);
      const balance = toNum(body.balance);
      const currency = typeof body.currency === 'string' ? body.currency : undefined;
      const message =
        required !== undefined && balance !== undefined
          ? `Insufficient credits. Required: $${required.toFixed(2)}, Available: $${balance.toFixed(2)}`
          : 'Insufficient credits to process this verification.';
      return new KYCError('insufficient_credits', message, { required, balance, currency });
    }
    if (err.statusCode === 403) {
      const feature = typeof err.body?.feature === 'string' ? err.body.feature : null;
      const message =
        err.code === 'id_type_not_allowed'
          ? "This ID type isn't enabled for your organization. Contact your administrator to request access."
          : feature === 'document_verification'
            ? 'Document verification is currently disabled for your organization.'
            : feature === 'gov_db_check'
              ? 'Government database verification is currently disabled for your organization.'
              : err.message || 'This verification feature is currently disabled for your organization.';
      return new KYCError('feature_disabled', message);
    }
    if (err.statusCode >= 500 || err.statusCode === 0) {
      // Transient server error that survived retries.
      const code: KYCErrorCode = context === 'upload' ? 'upload_failed' : 'network_error';
      return new KYCError(code, 'A server error occurred. Please try again in a moment.');
    }
    // Other 4xx — pass the server message through under the context's code.
    const code: KYCErrorCode = context === 'upload' ? 'upload_failed' : 'unknown';
    return new KYCError(code, err.message);
  }
  // fetch() throws a TypeError on network failure (offline / DNS / CORS).
  if (err instanceof TypeError) {
    return new KYCError(
      'network_error',
      'Network error. Please check your connection and try again.',
    );
  }
  const code: KYCErrorCode = context === 'upload' ? 'upload_failed' : 'unknown';
  return new KYCError(code, err instanceof Error ? err.message : 'Something went wrong. Please try again.');
}
