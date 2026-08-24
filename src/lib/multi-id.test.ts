import { describe, expect, it } from 'vitest';
import {
  multiIdConfigFrom,
  multiIdOfferedTypes,
  multiIdSlotOptions,
  multiIdFirstDeadEnd,
  multiIdSafeOptions,
  multiIdPlan,
} from './multi-id';

const CONFIG = { country: 'NG', countries: [{ country: 'NG' }], multiId: { count: 2, minPassed: 2 } };
const SERVER_TYPES = [
  { country: 'NG', idType: 'nin' },
  { country: 'NG', idType: 'bvn' },
  { country: 'NG', idType: 'passport' },
  { country: 'GH', idType: 'ghana-card' },
  { country: 'GH', idType: 'passport' },
];

describe('multiIdConfigFrom', () => {
  it('reads the block and clamps minPassed', () => {
    expect(multiIdConfigFrom({ multiId: { count: 3, minPassed: 9 } })).toEqual({
      count: 3,
      slots: undefined,
      minPassed: 3,
    });
  });
  it('is null for ordinary flows and every KYB flow', () => {
    expect(multiIdConfigFrom({})).toBeNull();
    expect(multiIdConfigFrom({ subjectType: 'business', multiId: { count: 2, minPassed: 2 } })).toBeNull();
    expect(multiIdConfigFrom({ multiId: { count: 1, minPassed: 1 } })).toBeNull();
  });
});

describe('multiIdOfferedTypes (per PICKED country)', () => {
  it('prefers that country\'s pinned list, else its granted set', () => {
    expect(multiIdOfferedTypes({ country: 'NG', idTypes: ['nin'] }, SERVER_TYPES)).toEqual(['nin']);
    expect(multiIdOfferedTypes({ country: 'NG' }, SERVER_TYPES)).toEqual(['nin', 'bvn', 'passport']);
  });

  it('follows the country the applicant picked in a multi-region flow', () => {
    const multiRegion = {
      countries: [
        { country: 'NG', idTypes: ['nin', 'bvn'] },
        { country: 'GH', idTypes: ['ghana-card'] },
      ],
    };
    // `country` is the EFFECTIVE country — what country-select resolved to.
    expect(multiIdOfferedTypes({ ...multiRegion, country: 'NG' }, SERVER_TYPES)).toEqual(['nin', 'bvn']);
    expect(multiIdOfferedTypes({ ...multiRegion, country: 'GH' }, SERVER_TYPES)).toEqual(['ghana-card']);
    // A country the flow does not serve offers nothing (never another's IDs).
    expect(multiIdOfferedTypes({ ...multiRegion, country: 'KE' }, SERVER_TYPES)).toEqual([]);
  });
});

describe('slot options + safety (mirrors the server)', () => {
  it('withholds a pick that would strand a later slot', () => {
    const options = multiIdSlotOptions(
      2,
      [{ idTypes: ['nin', 'bvn'] }, { idTypes: ['nin'] }],
      ['nin', 'bvn', 'passport'],
    );
    expect(multiIdSafeOptions(options, 0, [])).toEqual(['bvn']);
    expect(multiIdFirstDeadEnd(options)).toEqual({ picks: ['nin'], slotIndex: 1 });
  });
  it('excludes already-picked IDs', () => {
    const options = multiIdSlotOptions(2, undefined, ['nin', 'bvn']);
    expect(multiIdSafeOptions(options, 1, ['nin'])).toEqual(['bvn']);
  });
});

describe('multiIdPlan', () => {
  it('walks the PICKED country\'s slots in a multi-region flow', () => {
    const plan = multiIdPlan(
      {
        country: 'GH',
        countries: [
          { country: 'NG', multiIdSlots: [{ idTypes: ['nin'] }, { idTypes: ['bvn'] }] },
          { country: 'GH' },
        ],
        multiId: { count: 2, minPassed: 2 },
      },
      { multiIdSlotIndex: 0, multiIdSlots: [] },
      SERVER_TYPES,
    );
    // GH pins nothing, so its slots offer everything granted THERE — never NG's.
    expect(plan?.safeOptions).toEqual(['ghana-card', 'passport']);
  });

  it('tracks the walk through the slots', () => {
    const first = multiIdPlan(CONFIG, { multiIdSlotIndex: 0, multiIdSlots: [] }, SERVER_TYPES);
    expect(first).toMatchObject({ count: 2, index: 0, last: false });
    expect(first?.safeOptions).toEqual(['nin', 'bvn', 'passport']);

    const second = multiIdPlan(
      CONFIG,
      { multiIdSlotIndex: 1, multiIdSlots: [{ idType: 'nin' }] },
      SERVER_TYPES,
    );
    expect(second).toMatchObject({ index: 1, last: true, picked: ['nin'] });
    expect(second?.safeOptions).toEqual(['bvn', 'passport']);
  });
  it('is null for ordinary flows', () => {
    expect(multiIdPlan({ country: 'NG' }, { multiIdSlotIndex: 0, multiIdSlots: [] }, SERVER_TYPES)).toBeNull();
  });
});
