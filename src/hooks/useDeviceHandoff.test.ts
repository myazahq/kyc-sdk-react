import { describe, it, expect, vi } from 'vitest';

// The mint guard, tested as the logic it is rather than through a renderer.
//
// What broke: the effect called createHandoffSession with no idempotency guard,
// so StrictMode's deliberate double-invoke minted TWO sessions per visit and
// orphaned the first. `cancelled` looked like protection but only suppressed the
// state update — the request had already created the row.

/** The guard from useDeviceHandoff: share the in-flight promise per mint key. */
function makeMinter(create: () => Promise<{ sessionId: string }>) {
  const ref: { current: { key: string; promise: Promise<{ sessionId: string }> } | null } = {
    current: null,
  };
  return (nonce: number) => {
    const key = `${nonce}`;
    if (ref.current?.key !== key) ref.current = { key, promise: create() };
    return ref.current.promise;
  };
}

describe('the device-handoff mint guard', () => {
  it('mints ONCE when the effect runs twice for the same key', async () => {
    // Exactly StrictMode: mount, cleanup, mount again.
    const create = vi.fn().mockResolvedValue({ sessionId: 's1' });
    const mint = makeMinter(create);

    const first = mint(0);
    const second = mint(0);

    expect(create).toHaveBeenCalledTimes(1);
    // Both invocations resolve, so whichever handler is still live applies the
    // result — skipping the second run instead would hang the QR on "creating".
    await expect(first).resolves.toEqual({ sessionId: 's1' });
    await expect(second).resolves.toEqual({ sessionId: 's1' });
  });

  it('mints again when the user asks for a new code', async () => {
    // regenerate() bumps the nonce, and that must produce a real new session.
    const create = vi.fn().mockResolvedValue({ sessionId: 's' });
    const mint = makeMinter(create);

    mint(0);
    mint(1);

    expect(create).toHaveBeenCalledTimes(2);
  });

  it('lets a failed mint be retried', async () => {
    // A cached rejection would make the retry button re-read the same error
    // forever.
    const create = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ sessionId: 'ok' });
    const ref: { current: { key: string; promise: Promise<{ sessionId: string }> } | null } = { current: null };
    const mint = (nonce: number) => {
      const key = `${nonce}`;
      if (ref.current?.key !== key) ref.current = { key, promise: create() };
      return ref.current.promise.catch((e) => {
        if (ref.current?.key === key) ref.current = null;
        throw e;
      });
    };

    await expect(mint(0)).rejects.toThrow('offline');
    await expect(mint(0)).resolves.toEqual({ sessionId: 'ok' });
    expect(create).toHaveBeenCalledTimes(2);
  });
});
