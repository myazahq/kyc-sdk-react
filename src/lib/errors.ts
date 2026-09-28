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
import { defaultText } from '../i18n/translate';
import type { TextFn } from '../i18n/types';

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
const CODED_ERRORS: Record<string, { code: KYCErrorCode; key: string }> = {
  workflow_not_found: { code: 'invalid_workflow', key: 'general.error.workflowNotFound' },
  workflow_subject_mismatch: { code: 'invalid_workflow', key: 'general.error.workflowSubjectMismatch' },
  business_verifications_disabled: { code: 'feature_disabled', key: 'general.error.businessVerificationsDisabled' },
  country_mismatch: { code: 'invalid_workflow', key: 'general.error.countryMismatch' },
  product_unsupported: { code: 'invalid_workflow', key: 'general.error.productUnsupported' },
  registration_name_required: { code: 'unknown', key: 'general.error.registrationNameRequired' },
  only_test_ids_allowed: { code: 'unknown', key: 'general.error.onlyTestIdsAllowed' },
  pricing_not_configured: { code: 'unknown', key: 'general.error.pricingNotConfigured' },
};

/**
 * Maps an unknown error thrown by the API client to a typed {@link KYCError}
 * with a user-facing message. `context` selects the fallback code when the
 * failure isn't a specific HTTP status (e.g. a bare network failure during an
 * upload becomes `upload_failed`, during verify becomes `network_error`).
 * The messages come from the text catalogue (`general.error.*`) through `t`.
 */
export function mapToKycError(err: unknown, context: ErrorContext, t: TextFn = defaultText): KYCError {
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
          ? t('general.error.missingDocumentsNamed', { documents: labels.join(', ') })
          : t('general.error.missingDocuments'),
      );
    }
    const coded = err.code ? CODED_ERRORS[err.code] : undefined;
    if (coded) {
      return new KYCError(coded.code, t(coded.key));
    }
    if (err.statusCode === 401) {
      return new KYCError('invalid_api_key', t('general.error.invalidApiKey'));
    }
    if (err.statusCode === 402) {
      const body = err.body ?? {};
      const required = toNum(body.required);
      const balance = toNum(body.balance);
      const currency = typeof body.currency === 'string' ? body.currency : undefined;
      const message =
        required !== undefined && balance !== undefined
          ? t('general.error.insufficientCreditsAmounts', { required: required.toFixed(2), balance: balance.toFixed(2) })
          : t('general.error.insufficientCredits');
      return new KYCError('insufficient_credits', message, { required, balance, currency });
    }
    if (err.statusCode === 403) {
      const feature = typeof err.body?.feature === 'string' ? err.body.feature : null;
      const message =
        err.code === 'id_type_not_allowed'
          ? t('general.error.idTypeNotAllowed')
          : feature === 'document_verification'
            ? t('general.error.documentVerificationDisabled')
            : feature === 'gov_db_check'
              ? t('general.error.govDbCheckDisabled')
              : err.message || t('general.error.featureDisabled');
      return new KYCError('feature_disabled', message);
    }
    if (err.statusCode >= 500 || err.statusCode === 0) {
      // Transient server error that survived retries.
      const code: KYCErrorCode = context === 'upload' ? 'upload_failed' : 'network_error';
      return new KYCError(code, t('general.error.server'));
    }
    // Other 4xx — pass the server message through under the context's code.
    const code: KYCErrorCode = context === 'upload' ? 'upload_failed' : 'unknown';
    return new KYCError(code, err.message);
  }
  // fetch() throws a TypeError on network failure (offline / DNS / CORS).
  if (err instanceof TypeError) {
    return new KYCError('network_error', t('general.error.network'));
  }
  const code: KYCErrorCode = context === 'upload' ? 'upload_failed' : 'unknown';
  return new KYCError(code, err instanceof Error ? err.message : t('general.error.unknown'));
}
