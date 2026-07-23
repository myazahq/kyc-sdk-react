// Device CLASS detection for mobile-only workflows (`requireMobileDevice`).
//
// This is deliberately NOT `isDesktopDevice()` (device.ts), which decides
// whether to *offer* the handoff QR and is happy with viewport + pointer
// heuristics. A gate needs to survive a desktop browser pretending to be a
// phone — DevTools device mode / Safari Responsive Design Mode spoof the User
// Agent, UA-CH, touch points, pointer/hover media queries, screen metrics and
// devicePixelRatio, so every one of those is worthless on its own.
//
// Two things emulation cannot fake:
//   1. The GPU. `WEBGL_debug_renderer_info` reports the machine's real
//      renderer, so a desktop GPU behind a phone UA is a spoof, full stop.
//   2. Motion. A handheld device streams `devicemotion` events (gravity is
//      always there); a desktop has no accelerometer and emits nothing.
//
// The verdict requires POSITIVE confirmation: anything we can't confirm is a
// real handheld is treated as not-mobile, because the gate's whole job is to
// keep the flow off desktops.

export type DeviceClass = 'mobile' | 'desktop';

export interface DeviceClassResult {
  deviceClass: DeviceClass;
  /** Stable tokens for the signals that fired — surfaced to onError for support. */
  signals: string[];
}

// Chrome on Android also wraps its renderer in "ANGLE (...)", so ANGLE alone
// means nothing — the inner GPU name is what matters. Mobile is checked first.
const MOBILE_GPU_RE = /(Adreno|Mali[- ]|PowerVR|Apple GPU|Apple A\d|Tegra|Immortalis|Xclipse|Videocore)/i;
const DESKTOP_GPU_RE =
  /(GeForce|Quadro|RTX|GTX|Radeon|FirePro|Intel\(R\)|Iris|UHD Graphics|HD Graphics|Direct3D|llvmpipe|SwiftShader|Apple M\d|NVIDIA Corporation)/i;

const MOBILE_UA_RE =
  /(Android|iPhone|iPod|iPad|Windows Phone|IEMobile|BlackBerry|BB10|Opera Mini|Mobile Safari|Silk\/)/;

interface NavigatorUAData {
  mobile?: boolean;
}

function webglRenderer(): string | undefined {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return undefined;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return undefined;
    return String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
  } catch {
    return undefined; // masked by the browser (Firefox RFP, privacy extensions)
  }
}

/**
 * Synchronous pass — everything readable without waiting on a sensor.
 * `confirmMobileDevice` adds the motion probe on top.
 */
export function inspectDeviceClass(): DeviceClassResult {
  const signals: string[] = [];
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { deviceClass: 'desktop', signals: ['ssr'] };
  }

  const ua = navigator.userAgent ?? '';
  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
  const touchPoints = navigator.maxTouchPoints ?? 0;
  const mql = window.matchMedia?.bind(window);
  const coarsePointer = mql?.('(pointer: coarse)')?.matches ?? false;

  const uaMobile = MOBILE_UA_RE.test(ua) || uaData?.mobile === true;
  // iPadOS 13+ sends a Macintosh UA; its touch points give it away.
  const iPadOS = /Macintosh/.test(ua) && touchPoints > 1;
  if (uaMobile) signals.push('ua_mobile');
  if (iPadOS) signals.push('ipados');
  if (touchPoints > 0) signals.push('touch');
  if (coarsePointer) signals.push('pointer_coarse');

  // The veto: real desktop hardware, whatever the UA claims.
  const renderer = webglRenderer();
  if (renderer && !MOBILE_GPU_RE.test(renderer) && DESKTOP_GPU_RE.test(renderer)) {
    signals.push('gpu_desktop');
    if (uaMobile || iPadOS) signals.push('emulated_mobile');
    return { deviceClass: 'desktop', signals };
  }
  if (renderer && MOBILE_GPU_RE.test(renderer)) signals.push('gpu_mobile');

  const mobile = (uaMobile || iPadOS) && touchPoints > 0 && coarsePointer;
  return { deviceClass: mobile ? 'mobile' : 'desktop', signals };
}

/**
 * Can we listen for `devicemotion` without a permission prompt? iOS Safari
 * gates it behind `DeviceMotionEvent.requestPermission()` (a user gesture), so
 * there we skip the probe rather than interrupt the user with a sensor prompt.
 */
function motionProbeAvailable(): boolean {
  if (typeof window === 'undefined' || typeof window.DeviceMotionEvent === 'undefined') return false;
  const ctor = window.DeviceMotionEvent as unknown as { requestPermission?: unknown };
  return typeof ctor.requestPermission !== 'function';
}

/**
 * Waits for a real motion reading. A handheld device reports gravity
 * continuously; a desktop reports nothing. Resolves false on timeout.
 */
function probeMotion(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (moved: boolean) => {
      if (done) return;
      done = true;
      window.removeEventListener('devicemotion', onMotion);
      clearTimeout(timer);
      resolve(moved);
    };
    const onMotion = (e: DeviceMotionEvent) => {
      // Chrome fires one null-filled event on desktop before going quiet —
      // require actual sensor numbers.
      const g = e.accelerationIncludingGravity;
      const r = e.rotationRate;
      const hasReading =
        (g != null && (g.x != null || g.y != null || g.z != null)) ||
        (r != null && (r.alpha != null || r.beta != null || r.gamma != null));
      if (hasReading) finish(true);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    window.addEventListener('devicemotion', onMotion);
  });
}

/**
 * Full check: the synchronous verdict, then — when the sync pass says "mobile"
 * and we can listen silently — a motion probe to catch a desktop browser in
 * responsive/device-emulation mode (which spoofs everything the sync pass can
 * read, but has no accelerometer to fake).
 *
 * Resolves in `timeoutMs` worst case; a real phone answers in a few frames.
 */
export async function confirmMobileDevice(timeoutMs = 900): Promise<DeviceClassResult> {
  const sync = inspectDeviceClass();
  if (sync.deviceClass === 'desktop') return sync;
  if (!motionProbeAvailable()) {
    // iOS Safari (permission-gated) and browsers without the API: the sync
    // signals are all we have. Accept them rather than prompt or false-block.
    return { deviceClass: 'mobile', signals: [...sync.signals, 'motion_unavailable'] };
  }
  const moved = await probeMotion(timeoutMs);
  return moved
    ? { deviceClass: 'mobile', signals: [...sync.signals, 'motion_ok'] }
    : { deviceClass: 'desktop', signals: [...sync.signals, 'no_motion', 'emulated_mobile'] };
}
