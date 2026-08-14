import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  preferTorchCamera,
  trackHasTorch,
  cachedTorchCameraId,
  clearRearCameraCache,
  rearProbeDone,
} from './rear-camera';

// Measured on a real Samsung running Chrome 150:
//   camera 2, facing back → no torch capability  ← what facingMode picks
//   camera 0, facing back → torch: true          ← the lens with the flash
const NO_FLASH = 'cam2-back-no-flash';
const FLASH = 'cam0-back-flash';

function makeStream(deviceId: string, torch: boolean) {
  const stopped: string[] = [];
  const track = {
    getSettings: () => ({ deviceId }),
    getCapabilities: () => (torch ? { torch: true } : {}),
    stop: () => stopped.push(deviceId),
  } as unknown as MediaStreamTrack;
  const stream = {
    getVideoTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, stopped };
}

function mockDevices(labels: Array<{ deviceId: string; label: string }>) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: {
        enumerateDevices: async () =>
          labels.map((l) => ({ ...l, kind: 'videoinput' })),
      },
    },
  });
}

const BACK_CAMERAS = [
  { deviceId: NO_FLASH, label: 'camera 2, facing back' },
  { deviceId: FLASH, label: 'camera 0, facing back' },
  { deviceId: 'cam1-front', label: 'camera 1, facing front' },
];

beforeEach(() => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
    },
  });
  mockDevices(BACK_CAMERAS);
});

describe('trackHasTorch', () => {
  it('is true only when the capability is actually reported', () => {
    expect(trackHasTorch(makeStream(FLASH, true).stream.getVideoTracks()[0])).toBe(true);
    expect(trackHasTorch(makeStream(NO_FLASH, false).stream.getVideoTracks()[0])).toBe(false);
    expect(trackHasTorch(null)).toBe(false);
  });
});

describe('preferTorchCamera', () => {
  it('switches to the back camera that has a flash', async () => {
    const initial = makeStream(NO_FLASH, false);
    const reopen = vi.fn(async (id: string) => makeStream(id, id === FLASH).stream);

    const result = await preferTorchCamera(initial.stream, reopen);

    expect(result.getVideoTracks()[0].getSettings().deviceId).toBe(FLASH);
    // The first lens must be released: most phones allow only one camera open
    // at a time, so a candidate opened alongside it fails outright.
    expect(initial.stopped).toContain(NO_FLASH);
    expect(cachedTorchCameraId()).toBe(FLASH);
  });

  it('keeps the stream it was given when that camera already has a torch', async () => {
    const initial = makeStream(FLASH, true);
    const reopen = vi.fn();

    const result = await preferTorchCamera(initial.stream, reopen);

    expect(result).toBe(initial.stream);
    expect(reopen).not.toHaveBeenCalled();
    expect(cachedTorchCameraId()).toBe(FLASH);
  });

  it('never probes a front camera looking for a flash', async () => {
    const initial = makeStream(NO_FLASH, false);
    const tried: string[] = [];
    await preferTorchCamera(initial.stream, async (id) => {
      tried.push(id);
      return makeStream(id, id === FLASH).stream;
    });
    expect(tried).not.toContain('cam1-front');
  });

  it('records that this device has no torch, so it is probed only once', async () => {
    mockDevices([{ deviceId: NO_FLASH, label: 'camera 2, facing back' }]);
    const initial = makeStream(NO_FLASH, false);

    const result = await preferTorchCamera(initial.stream, async (id) =>
      makeStream(id, false).stream,
    );

    expect(result).toBe(initial.stream);
    expect(rearProbeDone()).toBe(true);
    expect(cachedTorchCameraId()).toBeNull();
  });

  it('still returns a working stream when a candidate refuses to open', async () => {
    const initial = makeStream(NO_FLASH, false);
    // NotReadableError is what a real device gave when a second camera was
    // opened before the first was released.
    const reopen = vi.fn(async (id: string) => {
      if (id === FLASH) throw Object.assign(new Error('busy'), { name: 'NotReadableError' });
      return makeStream(id, false).stream;
    });

    const result = await preferTorchCamera(initial.stream, reopen);

    expect(result.getVideoTracks()[0].getSettings().deviceId).toBe(NO_FLASH);
    expect(rearProbeDone()).toBe(true);
  });

  it('does not re-probe once a verdict is cached', async () => {
    const first = makeStream(NO_FLASH, false);
    await preferTorchCamera(first.stream, async (id) => makeStream(id, id === FLASH).stream);

    const second = makeStream(FLASH, true);
    const reopen = vi.fn();
    await preferTorchCamera(second.stream, reopen);
    expect(reopen).not.toHaveBeenCalled();
  });

  it('clearRearCameraCache forgets the verdict', async () => {
    const initial = makeStream(NO_FLASH, false);
    await preferTorchCamera(initial.stream, async (id) => makeStream(id, id === FLASH).stream);
    expect(rearProbeDone()).toBe(true);

    clearRearCameraCache();
    expect(rearProbeDone()).toBe(false);
    expect(cachedTorchCameraId()).toBeNull();
  });
});
