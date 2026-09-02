import { describe, it, expect } from 'vitest';
import { isUntouchedProgress } from './session-progress';
import { buildStepOrder } from './step-order';

describe('isUntouchedProgress', () => {
  // Load-bearing: the server reads "has stored progress" as "this person
  // started", so a save on the first screen would make every opened link look
  // like somebody was working through it.
  it('treats the flow as it opens as untouched', () => {
    expect(isUntouchedProgress({ step: 'consent', mediaIds: {}, data: {} })).toBe(true);
  });

  it('treats a payload with no step at all as untouched', () => {
    expect(isUntouchedProgress({})).toBe(true);
  });

  it('counts moving off the first screen as started', () => {
    expect(isUntouchedProgress({ step: 'id-type', mediaIds: {}, data: {} })).toBe(false);
  });

  it('counts a captured document as started', () => {
    expect(isUntouchedProgress({ step: 'consent', mediaIds: { documentFront: 'm_1' } })).toBe(false);
  });

  // Everything else errs towards saving: losing somebody's typing is a worse
  // failure than an over-eager label.
  it('counts entered details as started even on the first screen', () => {
    expect(isUntouchedProgress({ step: 'consent', data: { idNumber: '123' } })).toBe(false);
    expect(isUntouchedProgress({ step: 'consent', data: { selectedIdType: 'bvn' } })).toBe(false);
    expect(isUntouchedProgress({ step: 'consent', data: { selectedCountry: 'NG' } })).toBe(false);
  });

  // The predicate hangs on `consent` being the first step. If that ever stops
  // being true, every flow starts by saving and the distinction quietly dies.
  it('rests on consent being the first step of both flows', () => {
    const opts = {
      hasDocCapture: true,
      hasLiveness: true,
      hasCountrySelect: false,
      hasEmailVerification: false,
      hasPhoneVerification: false,
      hasPoa: false,
      hasAddressCollection: false,
      hasQuestionnaire: false,
    };
    expect(buildStepOrder({ ...opts, isBusiness: false })[0]).toBe('consent');
    expect(buildStepOrder({ ...opts, isBusiness: true })[0]).toBe('consent');
  });
});
