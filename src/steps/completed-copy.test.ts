import { describe, expect, it } from 'vitest';
import { decidedCopy } from './completed-copy';
import { NO_BIOMETRIC_COPY } from '../lib/biometric-copy';

const base = { isBusiness: false, scope: null, reason: null, words: NO_BIOMETRIC_COPY };

describe('decidedCopy', () => {
  it('keeps the org success copy on a mere submission', () => {
    expect(decidedCopy('submitted', base)).toBeNull();
  });

  it('names what was verified, by subject and scope', () => {
    expect(decidedCopy('approved', { ...base, isBusiness: true })?.description).toBe(
      'This business has been verified. There is nothing left to do here.',
    );
    expect(decidedCopy('approved', base)?.description).toBe('Your identity has been verified. There is nothing left to do here.');
    expect(decidedCopy('approved', { ...base, scope: 'address' })?.description).toBe(
      'Your address has been verified. There is nothing left to do here.',
    );
    const enrol = decidedCopy('approved', { ...base, scope: 'biometric-enrollment' })!;
    expect(enrol.title).toBe('Enrolment complete');
    expect(enrol.description).toContain('reference for your future face checks');
    expect(decidedCopy('declined', { ...base, scope: 'contact' })?.description).toBe(
      'Your contact details could not be verified. Contact the organisation that sent you this link to find out what happens next.',
    );
  });

  it('words a face check exactly as the in-flow verdict screen does, org copy included', () => {
    const ok = decidedCopy('approved', { ...base, scope: 'biometric-authentication' })!;
    expect(ok).toEqual({ tone: 'success', title: "You're verified", description: 'Your face matched the photo on record.' });
    const custom = decidedCopy('approved', {
      ...base,
      scope: 'biometric-authentication',
      words: { ...NO_BIOMETRIC_COPY, verified: { title: 'Welcome back, Ada' } },
    })!;
    expect(custom.title).toBe('Welcome back, Ada');
    expect(custom.description).toBe('Your face matched the photo on record.');
  });

  it("a declined face check shows the server's reason, and the org's declined words over that", () => {
    const reasoned = decidedCopy('declined', { ...base, scope: 'biometric-authentication', reason: 'The selfie did not match.' })!;
    expect(reasoned.tone).toBe('declined');
    expect(reasoned.title).toBe("We couldn't confirm it's you");
    expect(reasoned.description).toBe('The selfie did not match.');
    const worded = decidedCopy('declined', {
      ...base,
      scope: 'biometric-authentication',
      reason: 'The selfie did not match.',
      words: { ...NO_BIOMETRIC_COPY, declined: { description: 'Try again in better light.' } },
    })!;
    expect(worded.description).toBe('Try again in better light.');
  });

  it("the server's reason wins over the generic line everywhere else", () => {
    expect(decidedCopy('declined', { ...base, isBusiness: true, reason: 'Check the registration number.' })?.description).toBe(
      'Check the registration number.',
    );
    expect(decidedCopy('action_needed', { ...base, reason: 'Retake the document photo.' })?.description).toBe('Retake the document photo.');
    expect(decidedCopy('error', base)?.title).toBe('Something went wrong on our side');
  });

  it('carries no em dash in anything the person reads', () => {
    for (const scope of [null, 'address', 'biometric-authentication', 'biometric-enrollment', 'questionnaire', 'contact'] as const) {
      for (const isBusiness of [false, true]) {
        for (const outcome of ['approved', 'declined', 'action_needed', 'error'] as const) {
          const c = decidedCopy(outcome, { ...base, scope, isBusiness });
          expect(`${c?.title} ${c?.description}`).not.toContain('\u2014');
        }
      }
    }
  });
});
