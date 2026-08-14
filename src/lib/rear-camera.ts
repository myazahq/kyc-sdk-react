// ─── Rear camera selection ──────────────────────────────────────────────────
//
// `facingMode: { exact: 'environment' }` gets A back camera. It does not get
// the MAIN one, and on a multi-lens phone that difference decides whether the
// torch exists at all.
//
// Measured on a real device (Samsung, Chrome 150):
//
//   camera 2, facing back  →  no `torch` capability   ← what facingMode picked
//   camera 0, facing back  →  torch: true             ← the lens with the flash
//
// Secondary rear lenses (ultrawide, macro, depth) share no flash unit, so the
// capability is genuinely absent — no amount of waiting or re-reading finds it.
// The only way to the flash is to open the other camera by `deviceId`.
//
// It is worth more than the torch: camera 0 is the main sensor, and document
// OCR reads whatever lens took the photo.

const CACHE_KEY = 'myaza-kyc-rear-camera';
/** Cached when NO back camera on this device has a torch, so we probe once. */
const NONE = 'none';

interface TorchCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
}

export function trackHasTorch(track: MediaStreamTrack | null | undefined): boolean {
  if (!track || typeof track.getCapabilities !== 'function') return false;
  try {
    return (track.getCapabilities() as TorchCapabilities).torch === true;
  } catch {
    return false;
  }
}

function readCache(): string | null {
  try {
    return window.localStorage?.getItem(CACHE_KEY) ?? null;
  } catch {
    return null; // Storage can be blocked; probing again is the safe cost.
  }
}

function writeCache(value: string) {
  try {
    window.localStorage?.setItem(CACHE_KEY, value);
  } catch {
    /* not worth failing a capture over */
  }
}

export function clearRearCameraCache() {
  try {
    window.localStorage?.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * The rear camera known to have a torch on this device, if we have already
 * found one. Null means "not known yet"; `NONE` is stored separately so a
 * phone whose back cameras have no flash is not re-probed on every capture.
 */
export function cachedTorchCameraId(): string | null {
  const cached = readCache();
  return cached && cached !== NONE ? cached : null;
}

export function rearProbeDone(): boolean {
  return readCache() !== null;
}

async function backFacingDeviceIds(exclude?: string): Promise<string[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter(
        (d) =>
          d.kind === 'videoinput' &&
          d.deviceId &&
          d.deviceId !== exclude &&
          // Labels are only populated once permission is granted, which it is
          // by the time this runs. A device we cannot identify is skipped
          // rather than opened speculatively — opening the front camera to
          // look for a flash would be a pointless permission-lit intrusion.
          /\bback\b|\brear\b|environment/i.test(d.label),
      )
      .map((d) => d.deviceId);
  } catch {
    return [];
  }
}

/**
 * Given a freshly-opened rear stream, return one whose camera has a torch —
 * either the stream passed in, or a replacement opened on a different lens.
 *
 * Always returns a usable stream. If no back camera has a torch, or probing
 * fails, the original is handed back untouched: a missing torch button is a
 * far smaller problem than a capture screen with no camera.
 *
 * The result is cached, so the probe (and its brief switch) happens once per
 * browser rather than on every document capture.
 */
export async function preferTorchCamera(
  stream: MediaStream,
  reopen: (deviceId: string) => Promise<MediaStream>,
): Promise<MediaStream> {
  const track = stream.getVideoTracks()[0];
  if (!track) return stream;

  if (trackHasTorch(track)) {
    const id = track.getSettings().deviceId;
    if (id) writeCache(id);
    return stream;
  }
  // Already probed and found nothing — do not pay for it again.
  if (readCache() === NONE) return stream;

  const currentId = track.getSettings().deviceId;
  const candidates = await backFacingDeviceIds(currentId);
  if (candidates.length === 0) {
    writeCache(NONE);
    return stream;
  }

  for (const deviceId of candidates) {
    // Most phones allow only ONE camera open at a time — a candidate opened
    // alongside the current stream fails with NotReadableError. So release
    // first, and be prepared to reopen the original if the candidate refuses.
    stream.getTracks().forEach((t) => t.stop());
    try {
      const candidate = await reopen(deviceId);
      if (trackHasTorch(candidate.getVideoTracks()[0])) {
        writeCache(deviceId);
        return candidate;
      }
      candidate.getTracks().forEach((t) => t.stop());
    } catch {
      /* try the next one */
    }
  }

  writeCache(NONE);
  // Nothing better found, and the original was stopped to look. Reopening can
  // itself fail, in which case the caller's own error handling takes over.
  return reopen(currentId ?? '');
}
