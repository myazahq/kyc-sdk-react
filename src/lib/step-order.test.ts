import { describe, expect, it } from 'vitest';
import { buildStepOrder, getStepPosition, type StepOrderOptions } from './step-order';

const individual = (over: Partial<StepOrderOptions> = {}): StepOrderOptions => ({
  isBusiness: false,
  hasDocCapture: true,
  hasLiveness: true,
  hasCountrySelect: false,
  hasEmailVerification: false,
  hasPhoneVerification: false,
  hasPoa: false,
  hasQuestionnaire: false,
  ...over,
});

describe('getStepPosition', () => {
  it('does not count the success screen as a step', () => {
    // consent → id-type → document-capture → liveness → submitted.
    // The user performs FOUR steps; "submitted" is the outcome, not a step.
    const o = individual();
    expect(buildStepOrder(o)).toHaveLength(5);
    expect(getStepPosition('consent', o).total).toBe(4);
  });

  it('lets the last real step reach the end of the row', () => {
    // Counting `submitted` capped the final capture step at 4/5, so the row
    // never filled even though the user had finished everything.
    const o = individual();
    const { index, total } = getStepPosition('liveness', o);
    expect(index + 1).toBe(total);
  });

  it('draws no indicator on the success screen', () => {
    // index < 0 is the header's "render nothing" signal.
    expect(getStepPosition('submitted', individual())).toEqual({ index: -1, total: 0 });
  });

  it('draws no indicator for a step outside this flow', () => {
    // Liveness disabled ⇒ the liveness step is not part of the order.
    const o = individual({ hasLiveness: false });
    expect(getStepPosition('liveness', o).index).toBe(-1);
  });

  it('grows the count with optional steps', () => {
    const base = getStepPosition('consent', individual()).total;
    const withExtras = getStepPosition(
      'consent',
      individual({ hasPoa: true, hasQuestionnaire: true, hasEmailVerification: true }),
    ).total;
    expect(withExtras).toBe(base + 3);
  });

  it('borrows the document-capture slot for the preview-only nfc step', () => {
    // The web SDK never puts `nfc` in the order (Web NFC can't do ISO-DEP) but
    // renders its screen for the builder preview.
    const o = individual();
    expect(getStepPosition('nfc', o)).toEqual(getStepPosition('document-capture', o));
  });

  it('is 1-based and in range for every step of a flow', () => {
    const o = individual({ hasPoa: true, hasQuestionnaire: true, hasCountrySelect: true });
    for (const step of buildStepOrder(o).filter((s) => s !== 'submitted')) {
      const { index, total } = getStepPosition(step, o);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(total);
    }
  });
});
