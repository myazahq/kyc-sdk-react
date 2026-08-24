import { describe, expect, it } from 'vitest';
import { buildStepOrder, getStepPosition, type StepOrderOptions } from './step-order';
import { stepAfterCapture } from './post-capture';

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

describe('multi-ID step order', () => {
  it('keeps the normal single-pass order — the picker included', () => {
    const o = individual({ multiId: { index: 0, count: 2 } });
    expect(buildStepOrder(o)).toEqual([
      'consent',
      'id-type',
      'document-capture',
      'liveness',
      'submitted',
    ]);
  });

  it('KEEPS the country picker — multi-ID works multi-region', () => {
    // The applicant picks their country first, then walks THAT country's
    // slots (each country carries its own per-verification ID allowlists).
    const o = individual({ hasCountrySelect: true, multiId: { index: 0, count: 2 } });
    expect(buildStepOrder(o)).toContain('country-select');
    expect(buildStepOrder(o).indexOf('country-select')).toBeLessThan(
      buildStepOrder(o).indexOf('id-type'),
    );
  });

  it('stretches progress across the slots instead of snapping back', () => {
    const base = individual({ multiId: { index: 0, count: 3 } });
    // 4 real steps + 2 extra pairs = 8 positions.
    expect(getStepPosition('consent', base).total).toBe(8);
    expect(getStepPosition('id-type', base).index).toBe(1);

    // Slot 2's picker sits PAST slot 1's pair.
    const slot2 = individual({ multiId: { index: 1, count: 3 } });
    expect(getStepPosition('id-type', slot2).index).toBe(3);

    // Liveness (after the whole loop) sits past every pair, whatever the index.
    expect(getStepPosition('liveness', slot2).index).toBe(7);
    expect(getStepPosition('liveness', slot2).index + 1).toBe(getStepPosition('liveness', slot2).total);
  });
});

describe('stepAfterCapture in a business flow', () => {
  it("ends the applicant's capture leg at submission, never the questionnaire", () => {
    // The questionnaire was already asked back in the company section (before
    // key people). Returning it here again made the reordered flow a loop:
    // questionnaire → key people → applicant capture → questionnaire.
    expect(
      stepAfterCapture({
        subjectType: 'business',
        business: { country: 'NG' },
        questionnaire: { fields: [{ key: 'a', label: 'A', type: 'text' }] },
      }),
    ).toBe('submitted');
  });
});
