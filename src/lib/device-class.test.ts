import { describe, it, expect, afterEach, vi } from 'vitest';
import { inspectDeviceClass } from './device-class';

const UA = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

/** Minimal browser stand-in — only what inspectDeviceClass reads. */
function stubBrowser(opts: {
  ua: string;
  touchPoints: number;
  coarsePointer: boolean;
  renderer?: string;
  uaDataMobile?: boolean;
}) {
  vi.stubGlobal('window', {
    matchMedia: (q: string) => ({ matches: q.includes('coarse') ? opts.coarsePointer : !opts.coarsePointer }),
  });
  vi.stubGlobal('navigator', {
    userAgent: opts.ua,
    maxTouchPoints: opts.touchPoints,
    ...(opts.uaDataMobile !== undefined ? { userAgentData: { mobile: opts.uaDataMobile } } : {}),
  });
  vi.stubGlobal('document', {
    createElement: () => ({
      getContext: () =>
        opts.renderer
          ? { getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 1 }), getParameter: () => opts.renderer }
          : null,
    }),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('inspectDeviceClass', () => {
  it('confirms a real Android phone', () => {
    stubBrowser({
      ua: UA.androidChrome,
      touchPoints: 5,
      coarsePointer: true,
      renderer: 'ANGLE (Qualcomm, Adreno (TM) 642L, OpenGL ES 3.2)',
    });
    expect(inspectDeviceClass().deviceClass).toBe('mobile');
  });

  it('confirms a real iPhone', () => {
    stubBrowser({ ua: UA.iphoneSafari, touchPoints: 5, coarsePointer: true, renderer: 'Apple GPU' });
    expect(inspectDeviceClass().deviceClass).toBe('mobile');
  });

  it('confirms an iPad despite its Macintosh UA', () => {
    stubBrowser({ ua: UA.macSafari, touchPoints: 5, coarsePointer: true, renderer: 'Apple GPU' });
    const r = inspectDeviceClass();
    expect(r.deviceClass).toBe('mobile');
    expect(r.signals).toContain('ipados');
  });

  it('rejects an ordinary desktop', () => {
    stubBrowser({
      ua: UA.windowsChrome,
      touchPoints: 0,
      coarsePointer: false,
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    });
    expect(inspectDeviceClass().deviceClass).toBe('desktop');
  });

  it('rejects a desktop in device-emulation mode — spoofed UA/touch/pointer, real GPU', () => {
    stubBrowser({
      ua: UA.androidChrome,
      touchPoints: 5, // DevTools device mode reports touch
      coarsePointer: true, // …and a coarse pointer
      uaDataMobile: true, // …and UA-CH mobile
      renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.6)',
    });
    const r = inspectDeviceClass();
    expect(r.deviceClass).toBe('desktop');
    expect(r.signals).toContain('emulated_mobile');
  });

  it('rejects an Apple Silicon Mac emulating an iPhone in Chrome', () => {
    stubBrowser({
      ua: UA.iphoneSafari,
      touchPoints: 5,
      coarsePointer: true,
      renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)',
    });
    expect(inspectDeviceClass().deviceClass).toBe('desktop');
  });

  it('rejects a narrow desktop window (viewport size proves nothing)', () => {
    stubBrowser({ ua: UA.windowsChrome, touchPoints: 0, coarsePointer: false });
    expect(inspectDeviceClass().deviceClass).toBe('desktop');
  });

  it('accepts a phone whose browser masks the WebGL renderer', () => {
    stubBrowser({ ua: UA.androidChrome, touchPoints: 5, coarsePointer: true });
    expect(inspectDeviceClass().deviceClass).toBe('mobile');
  });

  it('is desktop during SSR', () => {
    expect(inspectDeviceClass().signals).toContain('ssr');
  });
});
