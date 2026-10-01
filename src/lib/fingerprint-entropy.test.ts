import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  audioHash,
  detectFonts,
  entropySnapshot,
  primeFingerprintEntropy,
  resetFingerprintEntropyForTests,
} from './fingerprint-entropy';
import { collectFingerprint } from './fingerprint';

/** A 2d context whose text width depends on the families in `ctx.font`. */
function stubCanvas(installed: string[], opts: { throws?: boolean } = {}) {
  const ctx = {
    font: '',
    measureText(this: { font: string }) {
      if (opts.throws) throw new Error('no canvas');
      const hit = installed.some((f) => this.font.includes(`"${f}"`));
      const base = this.font.includes('monospace') ? 100 : this.font.includes('sans-serif') ? 90 : 80;
      return { width: hit ? base + 7 : base };
    },
  };
  vi.stubGlobal('document', {
    createElement: () => ({ getContext: (kind: string) => (kind === '2d' ? ctx : null), toDataURL: () => 'data:' }),
  });
}

/** An OfflineAudioContext whose render resolves after `delayMs`. */
function stubAudio(delayMs: number, opts: { throws?: boolean } = {}) {
  const param = () => ({ value: 0 });
  class FakeCtx {
    destination = {};
    oncomplete: ((e: { renderedBuffer: unknown }) => void) | null = null;
    constructor() {
      if (opts.throws) throw new Error('blocked');
    }
    createOscillator() {
      return { type: '', frequency: param(), connect: () => undefined, start: () => undefined };
    }
    createDynamicsCompressor() {
      return { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), connect: () => undefined };
    }
    startRendering() {
      const data = new Float32Array(5000).map((_, i) => Math.sin(i) / 10);
      return new Promise((r) => setTimeout(() => r({ getChannelData: () => data }), delayMs));
    }
  }
  vi.stubGlobal('window', { OfflineAudioContext: FakeCtx, screen: undefined });
}

function stubNavigatorAndStorage() {
  vi.stubGlobal('navigator', { languages: ['en-GB'], hardwareConcurrency: 8, maxTouchPoints: 0, platform: 'MacIntel', plugins: [] });
  vi.stubGlobal('localStorage', { getItem: () => 'did-1', setItem: () => undefined });
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetFingerprintEntropyForTests();
});

describe('detectFonts', () => {
  it('lists the probed fonts that change the rendering, sorted', () => {
    stubCanvas(['Verdana', 'Arial', 'NotAProbe']);
    expect(detectFonts()).toEqual(['Arial', 'Verdana']);
  });

  it('is omitted when measuring throws or there is no document', () => {
    stubCanvas([], { throws: true });
    expect(detectFonts()).toBeUndefined();
    vi.unstubAllGlobals();
    vi.stubGlobal('document', undefined);
    expect(detectFonts()).toBeUndefined();
  });
});

describe('audioHash', () => {
  it('hashes the render as FNV-1a hex', async () => {
    stubAudio(0);
    expect(await audioHash()).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is omitted past the time bound', async () => {
    stubAudio(50);
    expect(await audioHash(10)).toBeUndefined();
  });

  it('is omitted when the API is missing or throws', async () => {
    vi.stubGlobal('window', {});
    expect(await audioHash()).toBeUndefined();
    stubAudio(0, { throws: true });
    expect(await audioHash()).toBeUndefined();
  });
});

describe('fingerprint.entropy', () => {
  it('rides beside components, never inside them', async () => {
    stubCanvas(['Arial']);
    stubAudio(0);
    stubNavigatorAndStorage();
    await primeFingerprintEntropy();
    const fp = collectFingerprint();
    expect(fp?.entropy).toEqual({ audioHash: expect.stringMatching(/^[0-9a-f]{8}$/), fonts: ['Arial'] });
    expect(fp?.components).not.toHaveProperty('entropy');
    expect(fp?.components).not.toHaveProperty('audioHash');
    expect(fp?.components).not.toHaveProperty('fonts');
    expect(fp?.deviceId).toBe('did-1');
  });

  it('falls back to fonts alone when the audio was never primed', () => {
    stubCanvas(['Georgia']);
    vi.stubGlobal('window', {});
    stubNavigatorAndStorage();
    expect(collectFingerprint()?.entropy).toEqual({ fonts: ['Georgia'] });
  });

  it('is omitted entirely when nothing can be read', async () => {
    stubCanvas([], { throws: true });
    vi.stubGlobal('window', {});
    await primeFingerprintEntropy();
    expect(entropySnapshot()).toBeUndefined();
  });
});
