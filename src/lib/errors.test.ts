import { describe, expect, it } from 'vitest';
import { KYCApiError } from '../services/api';
import { createTextFn } from '../i18n/translate';
import { mapToKycError } from './errors';

describe('mapToKycError messages', () => {
  it('keeps the default English', () => {
    expect(mapToKycError(new TypeError('fetch failed'), 'verify').message).toBe(
      'Network error. Please check your connection and try again.',
    );
  });

  it('reads its message through the text function it is given', () => {
    const t = (key: string) => (key === 'general.error.network' ? 'You seem to be offline.' : key);
    expect(mapToKycError(new TypeError('fetch failed'), 'verify', t).message).toBe('You seem to be offline.');
  });

  it('keeps its own wording whatever a workflow sets: errors are not customisable', () => {
    const t = createTextFn({ en: { 'general.error.network': 'You seem to be offline.' } });
    expect(mapToKycError(new TypeError('fetch failed'), 'verify', t).message).not.toBe('You seem to be offline.');
  });

  it('fills the credit amounts', () => {
    const err = new KYCApiError('Payment required', 402, 'insufficient_credits', { required: 1.5, balance: 0.25 });
    expect(mapToKycError(err, 'verify').message).toBe('Insufficient credits. Required: $1.50, Available: $0.25');
  });
});
