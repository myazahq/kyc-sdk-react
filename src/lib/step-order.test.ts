import { describe, expect, it } from 'vitest';
import { buildStepOrder, getStepPosition, type StepOrderOptions } from './step-order';
import { stepAfterCapture, stepAfterProofOfAddress } from './post-capture';
import { stepBeforeLiveness } from './contact-steps';

const individual = (over: Partial<StepOrderOptions> = {}): StepOrderOptions => ({
  isBusiness: false,
  hasDocCapture: true,
  hasLiveness: true,
  hasCountrySelect: false,
  hasEmailVerification: false,
  hasPhoneVerification: false,
  hasPoa: false,
  hasAddressCollection: false,
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


describe('address-collection step', () => {
  it('expands to pin + review after Proof of Address, before the questionnaire', () => {
    const order = buildStepOrder(
      individual({ hasPoa: true, hasAddressCollection: true, hasQuestionnaire: true }),
    );
    const poa = order.indexOf('proof-of-address');
    const address = order.indexOf('address-collection');
    const review = order.indexOf('address-review');
    const questionnaire = order.indexOf('questionnaire');
    expect(address).toBe(poa + 1);
    expect(review).toBe(address + 1);
    expect(questionnaire).toBe(review + 1);
  });

  it('adds the search and entrance steps when the flow offers them', () => {
    const order = buildStepOrder(
      individual({
        hasAddressCollection: true,
        addressFlow: { search: true, entrance: true },
      }),
    );
    expect(order.indexOf('address-search')).toBe(order.indexOf('address-collection') - 1);
    expect(order.indexOf('address-entrance')).toBe(order.indexOf('address-collection') + 1);
    expect(order.indexOf('address-review')).toBe(order.indexOf('address-entrance') + 1);
  });

  it('runs without PoA and is absent when disabled', () => {
    expect(buildStepOrder(individual({ hasAddressCollection: true }))).toContain('address-collection');
    expect(buildStepOrder(individual())).not.toContain('address-collection');
  });

  it('is reachable through the post-capture chain', () => {
    expect(stepAfterCapture({ addressCollection: { enabled: true } })).toBe('address-collection');
    // With a search backend on, entering the flow lands on SEARCH — routing
    // straight to the pin step skipped it entirely, which shipped.
    expect(
      stepAfterCapture({
        addressCollection: { enabled: true },
        serverConfig: { addressSearch: true },
      }),
    ).toBe('address-search');
    expect(
      stepAfterCapture({ proofOfAddress: { enabled: true }, addressCollection: { enabled: true } }),
    ).toBe('proof-of-address');
    expect(stepAfterProofOfAddress({ addressCollection: { enabled: true } })).toBe('address-collection');
    expect(stepAfterProofOfAddress({})).toBe('submitted');
  });
});

describe('scoped flows', () => {
  it('has no identity steps at all', () => {
    const order = buildStepOrder(
      individual({
        scope: 'address',
        hasAddressCollection: true,
        addressFlow: { search: true, entrance: true },
      }),
    );
    expect(order).toEqual([
      'consent',
      'address-search',
      'address-collection',
      'address-entrance',
      'address-review',
      'submitted',
    ]);
  });

  it('keeps the identity-free companions in their usual order', () => {
    const order = buildStepOrder(
      individual({
        scope: 'address',
        hasAddressCollection: true,
        hasEmailVerification: true,
        hasPhoneVerification: true,
        hasPoa: true,
        hasQuestionnaire: true,
      }),
    );
    expect(order).toEqual([
      'consent',
      'email-verification',
      'phone-verification',
      'proof-of-address',
      'address-collection',
      'address-review',
      'questionnaire',
      'submitted',
    ]);
    // Nothing about identity survives the branch.
    for (const step of ['id-type', 'id-input', 'document-capture', 'liveness', 'country-select']) {
      expect(order).not.toContain(step);
    }
  });
});

describe('the other scopes', () => {
  it('biometric scopes run only the liveness capture (plus companions)', () => {
    for (const scope of ['biometric-authentication', 'biometric-enrollment'] as const) {
      const order = buildStepOrder(individual({ scope, hasEmailVerification: true, hasQuestionnaire: true }));
      expect(order).toEqual(['consent', 'email-verification', 'liveness', 'questionnaire', 'submitted']);
    }
  });

  it('questionnaire scope is the questionnaire alone', () => {
    expect(buildStepOrder(individual({ scope: 'questionnaire', hasQuestionnaire: true }))).toEqual([
      'consent',
      'questionnaire',
      'submitted',
    ]);
  });

  it('contact scope is the codes alone', () => {
    expect(
      buildStepOrder(individual({ scope: 'contact', hasEmailVerification: true, hasPhoneVerification: true })),
    ).toEqual(['consent', 'email-verification', 'phone-verification', 'submitted']);
  });
});

// Back from liveness must land on whatever the flow actually put before it.
// The step used to hard-code the evidence step, which is right for a full flow
// and wrong for every face-scoped one: a biometric re-authentication went back
// to "Enter your ID Number", a screen its workflow does not contain.
describe('stepBeforeLiveness', () => {
  const base: StepOrderOptions = {
    isBusiness: false,
    hasDocCapture: false,
    hasLiveness: true,
    hasCountrySelect: false,
    hasEmailVerification: false,
    hasPhoneVerification: false,
    hasPoa: false,
    hasAddressCollection: false,
    hasQuestionnaire: false,
  };
  const before = (steps: readonly string[]) => steps[steps.indexOf('liveness') - 1];
  const on = { enabled: true } as never;

  for (const scope of ['biometric-authentication', 'biometric-enrollment'] as const) {
    it(`${scope}: agrees with the built order, with and without contact codes`, () => {
      expect(stepBeforeLiveness({ scope }, 'id-input')).toBe('consent');
      expect(before(buildStepOrder({ ...base, scope }))).toBe('consent');

      expect(stepBeforeLiveness({ scope, emailVerification: on }, 'id-input')).toBe(
        'email-verification',
      );
      expect(before(buildStepOrder({ ...base, scope, hasEmailVerification: true }))).toBe(
        'email-verification',
      );

      expect(
        stepBeforeLiveness({ scope, emailVerification: on, phoneVerification: on }, 'id-input'),
      ).toBe('phone-verification');
      expect(
        before(
          buildStepOrder({ ...base, scope, hasEmailVerification: true, hasPhoneVerification: true }),
        ),
      ).toBe('phone-verification');
    });

    it(`${scope}: never lands on an identity step`, () => {
      expect(stepBeforeLiveness({ scope }, 'document-capture')).not.toBe('document-capture');
      expect(stepBeforeLiveness({ scope }, 'id-input')).not.toBe('id-input');
    });
  }

  it('a full flow goes back to the evidence step it just walked', () => {
    expect(stepBeforeLiveness({}, 'id-input')).toBe('id-input');
    expect(stepBeforeLiveness({}, 'document-capture')).toBe('document-capture');
    expect(before(buildStepOrder(base))).toBe('id-input');
    expect(before(buildStepOrder({ ...base, hasDocCapture: true }))).toBe('document-capture');
  });

  it('ignores contact codes on a full flow — the evidence step sits between them and liveness', () => {
    expect(stepBeforeLiveness({ emailVerification: on, phoneVerification: on }, 'id-input')).toBe(
      'id-input',
    );
  });
});
