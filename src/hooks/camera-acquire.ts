// ─── Camera acquisition ─────────────────────────────────────────────────────
//
// Everything about WHICH camera to open, kept out of useCamera so the hook is
// just stream state. Two decisions live here, both learned from real devices.

import {
  buildVideoConstraints,
  type VideoCaptureConstraints,
} from '../lib/capture-settings';
import {
  cachedTorchCameraId,
  clearRearCameraCache,
  preferTorchCamera,
  rearProbeDone,
} from '../lib/rear-camera';

export type FacingMode = 'user' | 'environment';

function openWithFacingMode(
  mode: FacingMode,
  resolution: VideoCaptureConstraints,
): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: buildVideoConstraints(mode, resolution),
    audio: false,
  });
}

/** Open a specific camera, keeping the same resolution/frame-rate targets. */
function openByDeviceId(
  deviceId: string,
  resolution: VideoCaptureConstraints,
): Promise<MediaStream> {
  const { facingMode: _drop, ...rest } = buildVideoConstraints(
    'environment',
    resolution,
  );
  return navigator.mediaDevices.getUserMedia({
    video: { ...rest, deviceId: { exact: deviceId } },
    audio: false,
  });
}

/**
 * Ask for the requested camera EXACTLY first, then fall back to the hint.
 *
 * `facingMode: { ideal: 'environment' }` is only a preference, and a phone can
 * honour it by opening the FRONT camera anyway — which is what happened on a
 * real document capture: the user got a selfie view and photographed their
 * passport through it. `exact` makes the browser either give the rear camera
 * or refuse.
 *
 * The refusal is why the fallback exists: a desktop with only a webcam throws
 * OverconstrainedError on exact 'environment', and there the hint is the right
 * behaviour. So exact where it can be satisfied, ideal where it cannot, rather
 * than a hint that quietly picks the wrong lens.
 */
async function openFacing(
  mode: FacingMode,
  resolution: VideoCaptureConstraints,
): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        ...buildVideoConstraints(mode, resolution),
        facingMode: { exact: mode },
      },
      audio: false,
    });
  } catch (err) {
    const name = (err as { name?: string } | null)?.name;
    // Only a constraint failure earns the retry. A denied permission or a
    // missing device must surface as itself, not be masked by a second prompt
    // the user has to refuse twice.
    if (name !== 'OverconstrainedError' && name !== 'NotFoundError') throw err;
    return openWithFacingMode(mode, resolution);
  }
}

/**
 * Open the camera for `mode`, preferring a rear lens that has a torch.
 *
 * facingMode alone can land on a secondary rear lens with no flash unit (see
 * lib/rear-camera.ts). The upgrade runs once per browser and is then cached,
 * and it is never fatal: any failure leaves a working stream.
 */
export async function acquireCamera(
  mode: FacingMode,
  resolution: VideoCaptureConstraints,
): Promise<MediaStream> {
  const stream = await openFacing(mode, resolution);
  if (mode !== 'environment') return stream;

  const cachedId = cachedTorchCameraId();
  if (cachedId) {
    if (stream.getVideoTracks()[0]?.getSettings().deviceId === cachedId) return stream;
    // Known-good lens: go straight to it, no probing.
    try {
      stream.getTracks().forEach((t) => t.stop());
      return await openByDeviceId(cachedId, resolution);
    } catch {
      clearRearCameraCache(); // The id went stale; probe again next time.
      return openWithFacingMode(mode, resolution);
    }
  }

  if (rearProbeDone()) return stream;

  return preferTorchCamera(stream, (deviceId) =>
    deviceId
      ? openByDeviceId(deviceId, resolution)
      : openWithFacingMode(mode, resolution),
  );
}
