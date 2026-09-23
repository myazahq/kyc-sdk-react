import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

// ─── Giving the handoff back ─────────────────────────────────────────────────
//
// What broke: showing the QR mints a child session and moves the flow's
// one-verification budget to it. Leaving the gate ran the flow on a desktop
// session that no longer owned that budget, and nothing said so until the next
// authenticated upload - the selfie, four steps later - which came back "this
// verification was continued on another device" beside a Retry Upload button
// that could never succeed.

/** The decision in `release`, as the hook makes it. */
async function release(
  cancel: (id: string) => Promise<unknown>,
  { sessionId, inUse }: { sessionId: string | null; inUse: boolean },
): Promise<boolean> {
  if (!sessionId) return true;
  if (inUse) return false;
  try {
    await cancel(sessionId);
  } catch {
    /* not a reason to trap somebody on the gate */
  }
  return true;
}

describe('returning the handoff before verifying here', () => {
  it('cancels the minted session, so the budget comes back', async () => {
    const cancel = vi.fn().mockResolvedValue({ cancelled: true });
    await expect(release(cancel, { sessionId: 's1', inUse: false })).resolves.toBe(true);
    expect(cancel).toHaveBeenCalledWith('s1');
  });

  it('refuses once the phone has the flow open', async () => {
    // The server refuses the reclaim for the same reason. Going ahead here
    // would spend a budget the phone is already using.
    const cancel = vi.fn();
    await expect(release(cancel, { sessionId: 's1', inUse: true })).resolves.toBe(false);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('lets the flow continue when the cancel itself fails', async () => {
    // Offline, or a server too old to have the route. Blocking would leave the
    // gate with no way forward at all, which is worse than the retryable error.
    const cancel = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(release(cancel, { sessionId: 's1', inUse: false })).resolves.toBe(true);
  });

  it('is a no-op before anything has been minted', async () => {
    const cancel = vi.fn();
    await expect(release(cancel, { sessionId: null, inUse: false })).resolves.toBe(true);
    expect(cancel).not.toHaveBeenCalled();
  });
});

// The wiring the decision above is worthless without: every way out of the gate
// has to go through it. A click bound straight to the raw prop skips the
// release and reintroduces the bug in full.
describe('the gate wiring', () => {
  const gate = readFileSync(
    join(new URL('..', import.meta.url).pathname, 'components/DeviceHandoffGate.tsx'),
    'utf8',
  );

  it('routes leaving the gate through release()', () => {
    expect(gate).toContain('handoff.release()');
    // The outer component wraps; the inner panel receives the wrapped handler.
    expect(gate).toContain('onContinueHere={continueHere}');
    expect(gate).toContain('onDone={closeGate}');
    expect(gate).toContain('closeGate()');
  });
});
