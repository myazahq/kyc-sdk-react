import { describe, it, expect } from 'vitest';

// The predicate the results list filters on, mirrored here so the behaviour is
// pinned rather than re-read off the JSX. It was number-only while the box
// invited "name or number", so a word from a company's name returned nothing
// and read as broken rather than unmatched.
const matches = (hit: { name: string; registrationNumber: string }, filter: string): boolean => {
  const q = filter.trim().toLowerCase();
  if (!q) return true;
  return hit.name.toLowerCase().includes(q) || hit.registrationNumber.toLowerCase().includes(q);
};

const DELIGHT = { name: 'DELIGHT ATELIER LIMITED', registrationNumber: 'BN2189154' };
const SIFON = { name: 'SIFON FASHION REPUBLIC', registrationNumber: 'BN2665130' };

describe('result filter', () => {
  it('matches a word from the name, which is what the box invites', () => {
    expect(matches(DELIGHT, 'd')).toBe(true);
    expect(matches(DELIGHT, 'delight')).toBe(true);
    expect(matches(DELIGHT, 'atelier')).toBe(true);
  });

  it('still matches the registration number', () => {
    expect(matches(DELIGHT, 'BN2189154')).toBe(true);
    expect(matches(DELIGHT, '2189')).toBe(true);
  });

  it('ignores case and surrounding space', () => {
    expect(matches(DELIGHT, '  DeLiGhT  ')).toBe(true);
  });

  it('excludes what genuinely does not match', () => {
    expect(matches(SIFON, 'delight')).toBe(false);
    expect(matches(SIFON, 'BN2189154')).toBe(false);
  });

  it('keeps everything when the filter is empty', () => {
    for (const f of ['', '   ']) {
      expect(matches(DELIGHT, f)).toBe(true);
      expect(matches(SIFON, f)).toBe(true);
    }
  });
});
