// ---------------------------------------------------------------------------
// Capture-integrity signals, collected during the session and attached to the
// submit metadata (deviceMetadata.integrity on the server). Two families:
//
//  - camera: virtual-camera / injection heuristics inspected when the camera
//    stream starts (OBS, ManyCam, emulated devices defeat ANY liveness that
//    trusts the frames — this flags them for review, it never hard-blocks).
//  - liveness: how Presence Intelligence ran (mode, flash-challenge outcome,
//    face-continuity glitches) — audit context next to the liveness video.
// ---------------------------------------------------------------------------

export interface CameraIntegrity {
  suspect: boolean;
  signals: string[];
  label?: string;
}

export interface LivenessSignals {
  mode: 'gestures' | 'flash' | 'both';
  flash?: {
    passed: boolean;
    score: number;
    matched: number;
    total: number;
    inconclusive: boolean;
    sequence: string[];
  };
  /** Face-continuity glitches observed during gesture challenges. */
  faceGlitches?: number;
}

// Known virtual-camera / feed-injection software names (label substrings).
const VIRTUAL_CAMERA_MARKERS = [
  'obs',
  'virtual',
  'manycam',
  'xsplit',
  'snap camera',
  'droidcam',
  'iriun',
  'epoccam',
  'mmhmm',
  'splitcam',
  'youcam',
  'fake',
];

let cameraIntegrity: CameraIntegrity | null = null;
let livenessSignals: LivenessSignals | null = null;

/** Inspect a just-started camera stream for injection heuristics. Never throws. */
export function inspectCameraStream(stream: MediaStream): void {
  try {
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    const signals: string[] = [];
    const label = (track.label || '').toLowerCase();

    for (const marker of VIRTUAL_CAMERA_MARKERS) {
      if (label.includes(marker)) {
        signals.push(`virtual_camera_label:${marker}`);
        break;
      }
    }
    if (!track.label) signals.push('empty_device_label');

    // Real hardware exposes rich capabilities; virtual devices are often bare.
    const getCapabilities = (track as MediaStreamTrack & { getCapabilities?: () => Record<string, unknown> })
      .getCapabilities;
    if (typeof getCapabilities !== 'function') {
      signals.push('no_capabilities_api');
    } else {
      const caps = getCapabilities.call(track) ?? {};
      const keys = Object.keys(caps);
      if (keys.length === 0) signals.push('empty_capabilities');
      if (!('deviceId' in caps) && keys.length > 0) signals.push('no_capability_device_id');
    }

    const settings = track.getSettings?.() ?? {};
    if (settings.frameRate !== undefined && (settings.frameRate <= 0 || settings.frameRate > 240)) {
      signals.push('implausible_frame_rate');
    }

    // Suspect only on the strong marker — the heuristics alone flag too many
    // legitimate webcams; they still ride along as context for reviewers.
    const suspect = signals.some((s) => s.startsWith('virtual_camera_label'));
    cameraIntegrity = { suspect, signals, label: track.label || undefined };
  } catch {
    /* best-effort — never break camera startup */
  }
}

export function recordLivenessSignals(update: Partial<LivenessSignals> & { mode: LivenessSignals['mode'] }): void {
  livenessSignals = { ...livenessSignals, ...update };
}

/** Snapshot attached to the submit's device metadata (undefined when nothing collected). */
export function getIntegrityMetadata():
  | { camera?: CameraIntegrity; liveness?: LivenessSignals }
  | undefined {
  if (!cameraIntegrity && !livenessSignals) return undefined;
  return {
    ...(cameraIntegrity ? { camera: cameraIntegrity } : {}),
    ...(livenessSignals ? { liveness: livenessSignals } : {}),
  };
}

/** Reset between sessions (modal close). */
export function resetIntegritySignals(): void {
  cameraIntegrity = null;
  livenessSignals = null;
}
