import { describe, it, expect } from 'vitest';

/**
 * What makes the details step show the company card instead of the search box.
 *
 * It used to require a registration NAME as well as a number, which is a proxy
 * for "the applicant picked from search" — where both arrive together. That
 * silently defeated the other way a company gets named: an org prefilling one on
 * the session sends a number and no name, on purpose, because the registered
 * name is what the server token-matches for business.nameMatch and seeding it
 * from an operator's memory would feed the cross-check the thing it checks.
 *
 * So a prefilled session opened on a search box exactly as if nothing had been
 * passed to it.
 */
const picked = (registrationNumber: string) => registrationNumber.trim() !== '';

describe('naming the company', () => {
  it('a registration number is enough, however it arrived', () => {
    expect(picked('RC0000001')).toBe(true);
  });

  it('is false with nothing typed, so the search still opens', () => {
    expect(picked('')).toBe(false);
    expect(picked('   ')).toBe(false);
  });
});
