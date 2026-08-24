import { describe, it, expect } from 'vitest';
import { isValidWebsite } from './website';

describe('isValidWebsite', () => {
  it('accepts how people actually write a website', () => {
    for (const v of [
      'company.com',
      'www.company.com',
      'https://company.com',
      'http://company.com',
      'https://company.com/about',
      'sub.domain.company.co.uk',
      'company-name.ng',
      'COMPANY.COM',
      '  company.com  ',
    ]) {
      expect(isValidWebsite(v), v).toBe(true);
    }
  });

  it('rejects what is not a website', () => {
    for (const v of [
      'company',           // no dot at all
      'company.',          // trailing dot, no TLD
      '.com',              // no host
      'not a website',     // spaces
      'company..com',      // empty label
      '-company.com',      // leading hyphen
      '192.168.0.1',       // an address, not a site somebody typed
      'company.c',         // one-letter TLD
    ]) {
      expect(isValidWebsite(v), v).toBe(false);
    }
  });

  // A scheme we do not serve is a different thing in the box, not a typo in
  // this one. new URL() would have accepted both of these.
  it('rejects a non-http scheme rather than treating it as a host', () => {
    expect(isValidWebsite('mailto:hello@company.com')).toBe(false);
    expect(isValidWebsite('javascript:alert(1)')).toBe(false);
    expect(isValidWebsite('ftp://company.com')).toBe(false);
  });

  // Emptiness is the required-field check's job, not this one's.
  it('treats empty as nothing to complain about', () => {
    expect(isValidWebsite('')).toBe(true);
    expect(isValidWebsite('   ')).toBe(true);
  });
});
