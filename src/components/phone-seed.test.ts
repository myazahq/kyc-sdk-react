import { describe, it, expect } from 'vitest';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';

// The seed logic the control now runs: a supplied number decides its own dial
// code, and its national part becomes the visible value.
describe('phone seeding from a supplied E.164', () => {
  it('recovers the country and national part from the register value', () => {
    const p = parsePhoneNumberFromString('+234 000 000 0000');
    expect(p?.country).toBe('NG');
    expect(p?.nationalNumber).toBe('0000000000');
  });

  it('lets the number override a mismatched country guess', () => {
    const p = parsePhoneNumberFromString('+44 20 7946 0958');
    expect(p?.country).toBe('GB');
  });

  it('parses nothing from junk, so the guess still applies', () => {
    expect(parsePhoneNumberFromString('not a number')).toBeUndefined();
  });
});
