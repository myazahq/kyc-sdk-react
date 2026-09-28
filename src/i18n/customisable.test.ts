import { describe, expect, it } from 'vitest';
import { DEFAULT_TEXTS } from './catalogue';
import { CUSTOMISABLE_AVAILABILITY, CUSTOMISABLE_KEYS, CUSTOMISABLE_TEXTS } from './customisable';
import { resolveText } from './translate';

/** The only value a customisable text may fill in: the ID's name on the upload screens. */
const ALLOWED_TOKENS = ['document'];

describe('customisable texts', () => {
  const keys = [...CUSTOMISABLE_KEYS];

  it('are all real catalogue texts', () => {
    for (const key of keys) expect(DEFAULT_TEXTS[key], key).toBeTypeOf('string');
  });

  it('fill in no value except the document name, which the editor asks authors to keep', () => {
    for (const key of keys) {
      const tokens = [...DEFAULT_TEXTS[key].matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]);
      expect(tokens.every((token) => ALLOWED_TOKENS.includes(token)), key).toBe(true);
    }
  });

  it('leave out errors, hints, loading states, input placeholders and the legal line', () => {
    for (const key of keys) {
      expect(key).not.toMatch(/(^|\.)(error|errors|placeholder|loading|legal|retrying|sandbox|region)(\.|$)/i);
    }
    expect(CUSTOMISABLE_KEYS.has('welcome.legal.providedFor')).toBe(false);
  });

  it('keep a bounded list, grouped by screen with nothing empty', () => {
    expect(keys.length).toBeLessThanOrEqual(300);
    for (const group of CUSTOMISABLE_TEXTS) {
      expect(group.entries.length).toBeGreaterThan(0);
      for (const entry of group.entries) expect(entry.availability).toBe(CUSTOMISABLE_AVAILABILITY[entry.key]);
    }
  });

  it('are the only texts a workflow can change', () => {
    const texts = { en: { 'welcome.title': 'Hello', 'contact.error.invalidCode': 'Nope' } };
    expect(resolveText('welcome.title', { texts })).toBe('Hello');
    expect(resolveText('contact.error.invalidCode', { texts })).toBe(DEFAULT_TEXTS['contact.error.invalidCode']);
  });

  it('still honour an older copy field on any variant', () => {
    expect(resolveText('welcome.title.business', { legacy: 'Open an account' })).toBe('Open an account');
  });
});
