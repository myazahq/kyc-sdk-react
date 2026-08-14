import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  watchTorchSupport,
  TORCH_DETECT_POLL_MS,
  TORCH_DETECT_WINDOW_MS,
} from './useTorch';

/**
 * A track that reports no `torch` capability until `framesStart()` is called —
 * the Android Chrome behaviour that hid the button. Capabilities are
 * incomplete until the camera actually produces frames, so the read taken the
 * moment the stream arrives is the least likely one to get an answer.
 */
function makeTrack(opts: { hasTorch?: boolean; throwsBeforeLive?: boolean } = {}) {
  let live = false;
  const listeners: Record<string, Array<() => void>> = {};
  const track = {
    readyState: 'live' as MediaStreamTrackState,
    getCapabilities: () => {
      if (opts.throwsBeforeLive && !live) throw new Error('not ready');
      return live && opts.hasTorch !== false ? { torch: true } : {};
    },
    addEventListener: (type: string, fn: () => void) => {
      (listeners[type] ??= []).push(fn);
    },
    removeEventListener: (type: string, fn: () => void) => {
      listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
    },
  } as unknown as MediaStreamTrack;

  return {
    track,
    framesStart: () => {
      live = true;
    },
    end: () => {
      (track as { readyState: MediaStreamTrackState }).readyState = 'ended';
    },
    fireUnmute: () => listeners.unmute?.forEach((f) => f()),
    listenerCount: () => (listeners.unmute ?? []).length,
  };
}

describe('watchTorchSupport', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('finds the torch once the camera starts producing frames', () => {
    const { track, framesStart } = makeTrack({ hasTorch: true });
    const results: boolean[] = [];
    const stop = watchTorchSupport(track, (v) => results.push(v));

    // The read at stream-arrival time is the one that used to decide forever.
    expect(results).toEqual([false]);

    framesStart();
    vi.advanceTimersByTime(TORCH_DETECT_POLL_MS);
    expect(results.at(-1)).toBe(true);
    stop();
  });

  it('stops polling as soon as the answer is positive', () => {
    const { track, framesStart } = makeTrack({ hasTorch: true });
    const results: boolean[] = [];
    const stop = watchTorchSupport(track, (v) => results.push(v));

    framesStart();
    vi.advanceTimersByTime(TORCH_DETECT_POLL_MS);
    const settled = results.length;
    vi.advanceTimersByTime(TORCH_DETECT_POLL_MS * 5);
    expect(results.length).toBe(settled);
    stop();
  });

  it('reacts to the track unmuting without waiting for the next poll', () => {
    const { track, framesStart, fireUnmute } = makeTrack({ hasTorch: true });
    const results: boolean[] = [];
    const stop = watchTorchSupport(track, (v) => results.push(v));

    framesStart();
    fireUnmute();
    expect(results.at(-1)).toBe(true);
    stop();
  });

  it('retries when the track throws before it is live', () => {
    const { track, framesStart } = makeTrack({
      hasTorch: true,
      throwsBeforeLive: true,
    });
    const results: boolean[] = [];
    const stop = watchTorchSupport(track, (v) => results.push(v));
    expect(results.at(-1)).toBe(false);

    framesStart();
    vi.advanceTimersByTime(TORCH_DETECT_POLL_MS);
    expect(results.at(-1)).toBe(true);
    stop();
  });

  it('gives up after the detection window on a camera with no torch', () => {
    const { track, framesStart } = makeTrack({ hasTorch: false });
    const results: boolean[] = [];
    const stop = watchTorchSupport(track, (v) => results.push(v));

    framesStart();
    vi.advanceTimersByTime(TORCH_DETECT_WINDOW_MS + TORCH_DETECT_POLL_MS * 4);
    expect(results.every((v) => v === false)).toBe(true);

    const settled = results.length;
    vi.advanceTimersByTime(TORCH_DETECT_POLL_MS * 10);
    expect(results.length).toBe(settled);
    stop();
  });

  it('stops polling an ended track', () => {
    const { track, end } = makeTrack({ hasTorch: false });
    const results: boolean[] = [];
    const stop = watchTorchSupport(track, (v) => results.push(v));

    end();
    vi.advanceTimersByTime(TORCH_DETECT_POLL_MS * 3);
    expect(results.length).toBeLessThanOrEqual(2);
    stop();
  });

  it('reports no torch when the browser lacks getCapabilities', () => {
    const results: boolean[] = [];
    watchTorchSupport({} as MediaStreamTrack, (v) => results.push(v));
    expect(results).toEqual([false]);
  });

  it('reports no torch with no track', () => {
    const results: boolean[] = [];
    watchTorchSupport(null, (v) => results.push(v));
    expect(results).toEqual([false]);
  });

  it('cleanup stops the poll and unhooks the listener', () => {
    const { track, framesStart, listenerCount } = makeTrack({ hasTorch: true });
    const results: boolean[] = [];
    const stop = watchTorchSupport(track, (v) => results.push(v));
    expect(listenerCount()).toBe(1);

    stop();
    expect(listenerCount()).toBe(0);

    // A track that becomes capable after the stream was replaced must not
    // resurrect a torch button for a camera no longer on screen.
    framesStart();
    vi.advanceTimersByTime(TORCH_DETECT_POLL_MS * 4);
    expect(results.every((v) => v === false)).toBe(true);
  });
});
