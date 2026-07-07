// Device Intelligence — client fingerprint components. The SDK sends RAW
// components (never a self-computed ID): the server canonicalizes + hashes
// them, so a client can't mint a fresh identity by sending a random hash.
// Everything is best-effort and SSR-safe; a component that can't be read is
// simply omitted.

const DEVICE_ID_KEY = 'myaza-kyc-did';

export interface FingerprintComponents {
  screen?: { width: number; height: number; colorDepth: number; pixelRatio: number };
  timezone?: string;
  languages?: string[];
  hardwareConcurrency?: number;
  deviceMemory?: number;
  webglRenderer?: string;
  webglVendor?: string;
  canvasHash?: string;
  touchPoints?: number;
  platform?: string;
  webdriver?: boolean;
  pluginCount?: number;
}

export interface ClientFingerprint {
  /** Persistent per-install UUID — the deterministic companion to the fingerprint. */
  deviceId?: string;
  components: FingerprintComponents;
}

/** FNV-1a — tiny sync hash; the server re-hashes everything with SHA-256 anyway. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function persistentDeviceId(): string | undefined {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `did_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return undefined; // storage blocked (private mode) — fingerprint still works
  }
}

function webglInfo(): { renderer?: string; vendor?: string } {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return {};
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : undefined,
      vendor: ext ? String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)) : undefined,
    };
  } catch {
    return {};
  }
}

function canvasHash(): string | undefined {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    // Mixed text/shape rendering — different GPU/driver/font stacks rasterize
    // this measurably differently.
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(100, 5, 80, 30);
    ctx.fillStyle = '#069';
    ctx.font = '15px Arial';
    ctx.fillText('Myaza KYC 🛡 fingerprint', 4, 35);
    ctx.strokeStyle = 'rgba(120, 60, 200, 0.7)';
    ctx.beginPath();
    ctx.arc(60, 30, 20, 0, Math.PI * 1.5);
    ctx.stroke();
    return fnv1a(canvas.toDataURL());
  } catch {
    return undefined;
  }
}

/** Collect the fingerprint. Sync, ~1ms; call once at submit time. */
export function collectFingerprint(): ClientFingerprint | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const gl = webglInfo();
    const canvas = canvasHash();
    const components: FingerprintComponents = {
      ...(typeof window.screen !== 'undefined' && {
        screen: {
          width: window.screen.width,
          height: window.screen.height,
          colorDepth: window.screen.colorDepth,
          pixelRatio: window.devicePixelRatio ?? 1,
        },
      }),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      languages: Array.from(nav.languages ?? []).slice(0, 5),
      hardwareConcurrency: nav.hardwareConcurrency,
      ...(nav.deviceMemory !== undefined && { deviceMemory: nav.deviceMemory }),
      ...(gl.renderer && { webglRenderer: gl.renderer }),
      ...(gl.vendor && { webglVendor: gl.vendor }),
      ...(canvas !== undefined && { canvasHash: canvas }),
      touchPoints: nav.maxTouchPoints ?? 0,
      platform: nav.platform,
      webdriver: nav.webdriver === true,
      pluginCount: nav.plugins?.length ?? 0,
    };
    return { deviceId: persistentDeviceId(), components };
  } catch {
    return null;
  }
}
