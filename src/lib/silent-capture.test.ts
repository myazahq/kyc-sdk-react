import { beforeEach, describe, expect, it } from 'vitest';
import {
  SILENT_CAPTURE_LIMIT,
  buildSilentCaptureSubmission,
  canTakeSilentFrame,
  silentCaptureApplies,
  silentFrameSize,
  withSilentCaptureDevice,
  type SilentFrame,
} from './silent-capture';
import {
  reserveSilentFrame,
  resetSilentCaptures,
  settleSilentUploads,
  silentCaptureSubmission,
  silentFrames,
  uploadSilentFrame,
} from './silent-capture-store';

const frame = (mediaId?: string, at = '2026-09-27T10:00:00.000Z'): SilentFrame => ({
  moment: 'document',
  capturedAt: at,
  ...(mediaId ? { mediaId } : {}),
});

describe('whether silent capture runs', () => {
  it('is on unless the workflow says exactly false', () => {
    expect(silentCaptureApplies({})).toBe(true);
    expect(silentCaptureApplies({ silentCapture: true })).toBe(true);
    expect(silentCaptureApplies({ silentCapture: null })).toBe(true);
    expect(silentCaptureApplies({ silentCapture: false })).toBe(false);
  });

  it('never runs in the builder preview', () => {
    expect(silentCaptureApplies({ previewMode: true })).toBe(false);
  });

  it('never runs on a scoped flow: none of them captures a document', () => {
    for (const scope of ['biometric-authentication', 'biometric-enrollment', 'address', 'contact', 'questionnaire']) {
      expect(silentCaptureApplies({ scope })).toBe(false);
    }
  });
});

describe('the limit', () => {
  it('allows document frames up to three in total', () => {
    expect(canTakeSilentFrame([])).toBe(true);
    expect(canTakeSilentFrame([frame(), frame()])).toBe(true);
    const three = [frame(), frame(), frame()];
    expect(three).toHaveLength(SILENT_CAPTURE_LIMIT);
    expect(canTakeSilentFrame(three)).toBe(false);
  });
});

describe('the submission', () => {
  it('numbers uploaded frames 1..n in capture order, with the device entries to match', () => {
    const out = buildSilentCaptureSubmission([
      frame('med_a', '2026-09-27T10:00:01.000Z'),
      frame('med_b', '2026-09-27T10:00:05.000Z'),
    ]);
    expect(out.mediaIds).toEqual({ silentCapture1: 'med_a', silentCapture2: 'med_b' });
    expect(out.device).toEqual([
      { slot: 1, moment: 'document', capturedAt: '2026-09-27T10:00:01.000Z' },
      { slot: 2, moment: 'document', capturedAt: '2026-09-27T10:00:05.000Z' },
    ]);
  });

  it('leaves no gap where an upload failed', () => {
    const out = buildSilentCaptureSubmission([frame('med_a'), frame(), frame('med_c')]);
    expect(out.mediaIds).toEqual({ silentCapture1: 'med_a', silentCapture2: 'med_c' });
    expect(out.device.map((d) => d.slot)).toEqual([1, 2]);
  });

  it('submits nothing, and adds nothing to the device block, without uploaded frames', () => {
    const out = buildSilentCaptureSubmission([frame()]);
    expect(out).toEqual({ mediaIds: {}, device: [] });
    const device = { os: 'macOS' };
    expect(withSilentCaptureDevice(device, out.device)).toBe(device);
  });

  it('describes the frames beside the existing device fields', () => {
    const entries = [{ slot: 1, moment: 'document' as const, capturedAt: 'x' }];
    expect(withSilentCaptureDevice({ os: 'macOS' }, entries)).toEqual({ os: 'macOS', silentCapture: entries });
    expect(withSilentCaptureDevice(undefined, entries)).toEqual({ silentCapture: entries });
  });
});

describe('frame size', () => {
  it('scales the long edge down to 640 and never scales up', () => {
    expect(silentFrameSize(1280, 720)).toEqual({ width: 640, height: 360 });
    expect(silentFrameSize(720, 1280)).toEqual({ width: 360, height: 640 });
    expect(silentFrameSize(480, 360)).toEqual({ width: 480, height: 360 });
  });
});

describe('the per-session record', () => {
  beforeEach(() => resetSilentCaptures());

  it('reserves up to the limit and keeps frames across step revisits', () => {
    expect(reserveSilentFrame('document')).not.toBeNull();
    expect(reserveSilentFrame('document')).not.toBeNull();
    expect(reserveSilentFrame('document')).not.toBeNull();
    expect(reserveSilentFrame('document')).toBeNull();
    expect(silentFrames()).toHaveLength(3);
  });

  it('submits only the frames whose upload succeeded', async () => {
    const a = reserveSilentFrame('document')!;
    const b = reserveSilentFrame('document')!;
    uploadSilentFrame(a, () => Promise.resolve('med_a'));
    uploadSilentFrame(b, () => Promise.reject(new Error('offline')));
    await settleSilentUploads();
    expect(silentCaptureSubmission().mediaIds).toEqual({ silentCapture1: 'med_a' });
  });

  it('drops an upload that lands after the session was reset', async () => {
    const a = reserveSilentFrame('document')!;
    let finish: (id: string) => void = () => undefined;
    uploadSilentFrame(a, () => new Promise<string>((resolve) => (finish = resolve)));
    resetSilentCaptures();
    finish('med_old');
    await Promise.resolve();
    await Promise.resolve();
    expect(silentCaptureSubmission().mediaIds).toEqual({});
  });

  it('does not wait past its timeout for an upload that never settles', async () => {
    const a = reserveSilentFrame('document')!;
    uploadSilentFrame(a, () => new Promise<string>(() => undefined));
    const started = Date.now();
    await settleSilentUploads(20);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(silentCaptureSubmission().device).toEqual([]);
  });
});
