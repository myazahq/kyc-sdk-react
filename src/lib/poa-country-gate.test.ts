import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { poaCountryDeclared, poaOfferedCountries } from './poa-country-gate';

// The Proof of Address step's Continue holds until the address scope's country
// is declared (user decision 2026-09-08). Mirrored on RN and Flutter.
describe('poaCountryDeclared', () => {
  it('outside the address scope the flow country stands', () => {
    expect(poaCountryDeclared({ scope: null, selectedCountry: null, offered: [] })).toBe(true);
    expect(poaCountryDeclared({ scope: 'contact', selectedCountry: null, offered: [] })).toBe(true);
  });

  it('on the address scope a picked country declares it', () => {
    expect(poaCountryDeclared({ scope: 'address', selectedCountry: 'NG', offered: ['NG', 'GH'] })).toBe(true);
    expect(poaCountryDeclared({ scope: 'address', selectedCountry: null, offered: ['NG', 'GH'] })).toBe(false);
    expect(poaCountryDeclared({ scope: 'address', selectedCountry: ' ', offered: ['NG', 'GH'] })).toBe(false);
  });

  it('one accepted country is a settled fact, not a choice', () => {
    expect(poaCountryDeclared({ scope: 'address', selectedCountry: null, offered: ['NG'] })).toBe(true);
  });

  it('the offered list is the org list, unknown codes dropped, else the world', () => {
    expect(poaOfferedCountries(['ng', 'XX', 'GH'])).toEqual(['NG', 'GH']);
    expect(poaOfferedCountries(undefined).length).toBeGreaterThan(100);
  });

  it('the PoA step gates Continue on it', () => {
    const src = readFileSync(new URL('../steps/ProofOfAddressStep.tsx', import.meta.url).pathname, 'utf8');
    expect(src).toContain('poaCountryDeclared(');
    expect(src).toMatch(/disabled=\{!uploaded \|\| uploading \|\| !countryDeclared\}/);
  });
});
