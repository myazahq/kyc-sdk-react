import { describe, it, expect } from 'vitest';
import { defaultCountry } from './country-default';

describe('defaultCountry', () => {
  it('takes the first thing anybody actually said', () => {
    expect(defaultCountry('gh', 'NG', 'FR')).toBe('GH');
  });

  it('skips blanks and whitespace rather than treating them as answers', () => {
    expect(defaultCountry(undefined, null, '  ', 'KE')).toBe('KE');
  });

  it('falls through to the IP guess when nothing better was passed', () => {
    // The caller decides where the IP sits in its own list; this only proves a
    // later candidate is reached.
    expect(defaultCountry(undefined, 'ZA')).toBe('ZA');
  });

  it('returns undefined when nothing is known, rather than inventing a country', () => {
    // The call site owns its own last resort, so this must not smuggle one in.
    expect(defaultCountry(undefined, null, '')).toBeUndefined();
  });

  it('normalises case, because ISO-2 comparisons downstream are exact', () => {
    expect(defaultCountry('ng')).toBe('NG');
  });
});
