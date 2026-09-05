import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomId } from './random-id';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('randomId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the platform uuid when it exists', () => {
    expect(randomId()).toMatch(V4);
  });

  it('still mints a v4 id on an insecure origin, where randomUUID is absent', () => {
    // A LAN address over http: getRandomValues works, randomUUID does not.
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => a.fill(7) });
    expect(randomId()).toMatch(V4);
    expect(randomId()).not.toBe('');
  });

  it('never throws even with no crypto at all', () => {
    vi.stubGlobal('crypto', undefined);
    expect(randomId()).toMatch(V4);
    expect(randomId()).not.toBe(randomId());
  });
});
