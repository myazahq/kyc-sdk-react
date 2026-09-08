import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The completed mount hydrates the config provider with an EXPLICIT prop list,
// and a key left off it is silently invisible to the screen. The scope was
// missing, so a finished face check read "This business has been verified"
// (user report 2026-09-08): the fifth gap of this kind (the preview page, the
// hosted flow, and now this mount). This pins every key the returning screen
// reads. Same source-scan idiom as hosted-lifecycle.test.ts.
const read = (p: string) => readFileSync(new URL(p, import.meta.url).pathname, 'utf8');

// What CompletedStep, success-copy and biometric-copy read off the config.
const COMPLETED_KEYS = ['appearance', 'success', 'userData', 'addressCollection', 'scope', 'biometric', 'assetsBasePath'];

describe('HostedCompleted', () => {
  const mount = read('./HostedCompleted.tsx');

  it('forwards every key the returning screen reads', () => {
    const missing = COMPLETED_KEYS.filter((key) => !mount.includes(`${key}={`));
    expect(missing).toEqual([]);
  });
});
