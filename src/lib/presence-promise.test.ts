import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { showsPresencePromise } from './presence-promise';

// Production, 2026-09-28: the web SDK showed "Address check active" after a
// browser submission, while no browser flow can ever report presence and the
// server now starts no watch for one. The promise survives only in the
// builder preview, where the web SDK stands in for the mobile screens.

const presenceOn = { addressCollection: { presence: { enabled: true } } };

describe('showsPresencePromise', () => {
  it('never promises a presence check in a live browser flow', () => {
    expect(showsPresencePromise(presenceOn)).toBe(false);
    expect(showsPresencePromise({ ...presenceOn, previewMode: false })).toBe(false);
  });

  it('keeps the promise in the builder preview', () => {
    expect(showsPresencePromise({ ...presenceOn, previewMode: true })).toBe(true);
  });

  it('is off whenever presence itself is off', () => {
    expect(showsPresencePromise({ previewMode: true })).toBe(false);
    expect(
      showsPresencePromise({ previewMode: true, addressCollection: { presence: { enabled: false } } }),
    ).toBe(false);
  });

  it('is the only gate the presence screens use', () => {
    // A screen reading `presence.enabled` directly would bring the false
    // promise back on live browser flows.
    for (const file of ['SubmittedStep.tsx', 'CompletedStep.tsx', 'address/AddressIntroGate.tsx']) {
      const source = readFileSync(new URL(`../steps/${file}`, import.meta.url).pathname, 'utf8');
      expect(source, file).toContain('showsPresencePromise(config)');
      expect(source, file).not.toMatch(/presence\?\.enabled === true/);
    }
  });
});
