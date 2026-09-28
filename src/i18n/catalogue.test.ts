import { describe, expect, it } from 'vitest';
import { DEFAULT_TEXTS, TEXT_GROUPS } from './catalogue';

const KEY = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/;

describe('text catalogue', () => {
  const entries = TEXT_GROUPS.flatMap((group) => group.entries);

  it('gives every text a unique, well-formed key under its group', () => {
    const keys = entries.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const group of TEXT_GROUPS) {
      for (const entry of group.entries) {
        expect(entry.key, entry.key).toMatch(KEY);
        expect(entry.key.startsWith(`${group.id}.`), `${entry.key} is in ${group.id}`).toBe(true);
      }
    }
  });

  it('gives every text a label and a default', () => {
    for (const entry of entries) {
      expect(entry.label.trim(), entry.key).not.toBe('');
      expect(entry.default.trim(), entry.key).not.toBe('');
      expect(DEFAULT_TEXTS[entry.key]).toBe(entry.default);
    }
  });

  it('declares every placeholder a default uses', () => {
    const tokens = new Set(['firstName', 'lastName', 'businessName']);
    for (const entry of entries) {
      const used = [...entry.default.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)].map((m) => m[1]);
      for (const name of used) {
        if (tokens.has(name)) continue;
        expect(entry.placeholders ?? [], `${entry.key} uses {${name}}`).toContain(name);
      }
    }
  });

  it('has no em dashes in customer-facing defaults', () => {
    for (const entry of entries) expect(entry.default, entry.key).not.toContain('—');
  });
});
