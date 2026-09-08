import { describe, expect, it } from 'vitest';
import { poaNamePolicy, poaOfferedKinds } from './post-capture';

describe('poaOfferedKinds', () => {
  it('offers every kind this build knows when the workflow does not narrow it', () => {
    expect(poaOfferedKinds(undefined, 'NG')).toEqual([
      'utility_bill',
      'bank_statement',
      'tenancy_agreement',
      'government_document',
      'other',
    ]);
  });

  it("a country's override replaces the global list for that country alone", () => {
    const poa = { documentTypes: ['utility_bill' as const], countryDocuments: { GB: ['bank_statement' as const] } };
    expect(poaOfferedKinds(poa, 'gb')).toEqual(['bank_statement']);
    expect(poaOfferedKinds(poa, 'NG')).toEqual(['utility_bill']);
  });

  it('hides a kind this build does not know rather than drawing a blank card', () => {
    const poa = { documentTypes: ['utility_bill', 'holographic_deed'] as never };
    expect(poaOfferedKinds(poa, 'NG')).toEqual(['utility_bill']);
    // An override made ONLY of unknown kinds falls through, never to nothing.
    expect(poaOfferedKinds({ countryDocuments: { NG: ['holographic_deed'] as never } }, 'NG')).toHaveLength(5);
  });
});

describe('poaNamePolicy', () => {
  it('is required when the workflow says nothing', () => {
    expect(poaNamePolicy(undefined, 'NG', 'utility_bill')).toBe('required');
  });

  it("a country's per-kind exception beats the workflow default for that kind alone", () => {
    const poa = { nameMatch: 'optional' as const, countryNameMatch: { NG: { utility_bill: 'off' as const } } };
    expect(poaNamePolicy(poa, 'ng', 'utility_bill')).toBe('off');
    expect(poaNamePolicy(poa, 'NG', 'bank_statement')).toBe('optional');
    expect(poaNamePolicy(poa, 'GH', 'utility_bill')).toBe('optional');
  });
});
