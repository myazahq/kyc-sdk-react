import { KYCApiError } from '../services/api';

// User-facing copy for the contact-verification send/check error codes.

const CHECK_ERRORS: Record<string, string> = {
  invalid_code: 'That code is not correct. Please try again.',
  challenge_expired: 'This code has expired. Request a new one.',
  too_many_attempts: 'Too many incorrect attempts. Request a new code.',
  challenge_not_found: 'This code is no longer valid. Request a new one.',
};

const SEND_ERRORS: Record<string, string> = {
  invalid_destination: 'That does not look valid. Please check and try again.',
  send_rate_limited: 'Too many codes requested. Please wait a while and try again.',
  send_failed: 'We could not send the code. Please try again.',
};

function describe(err: unknown, map: Record<string, string>): string {
  if (err instanceof KYCApiError && err.code && map[err.code]) return map[err.code]!;
  if (err instanceof TypeError) return 'Network error. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}

export const describeSendError = (err: unknown): string => describe(err, SEND_ERRORS);
export const describeCheckError = (err: unknown): string => describe(err, CHECK_ERRORS);
