import { useCallback, useEffect, useState } from 'react';

/**
 * Torch (flash) control for a live camera stream.
 *
 * Availability is DETECTED from the track, never inferred from the platform.
 * The capability moved: Safari gained the `torch` constraint in 17.4, so a
 * user-agent check would have withheld the button from iPhones that support it
 * — and would go on being wrong every time a browser ships the feature. Asking
 * the track is both simpler and self-correcting.
 *
 * `getCapabilities` itself is not universal (Firefox lacks it), so its absence
 * is treated as "no torch" rather than an error: the button hides and the
 * shutter stays centred.
 */

// `torch` is not in the DOM lib's MediaTrackCapabilities/Constraints yet.
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };
type TorchConstraint = MediaTrackConstraintSet & { torch?: boolean };

/** How long to keep asking a freshly-started track whether it has a torch. */
export const TORCH_DETECT_WINDOW_MS = 3000;
/** Gap between capability reads while waiting for the camera to produce frames. */
export const TORCH_DETECT_POLL_MS = 250;

function videoTrack(stream: MediaStream | null): MediaStreamTrack | null {
  return stream?.getVideoTracks?.()[0] ?? null;
}

/**
 * Watch a track until it admits whether it has a torch, calling `onResult` with
 * each answer. Returns a cleanup function.
 *
 * Kept out of the hook so the retry — the part that actually had the bug — is
 * testable without a DOM.
 */
export function watchTorchSupport(
  track: MediaStreamTrack | null,
  onResult: (supported: boolean) => void,
): () => void {
  if (!track || typeof track.getCapabilities !== 'function') {
    onResult(false);
    return () => undefined;
  }

  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = Date.now() + TORCH_DETECT_WINDOW_MS;

  const read = () => {
    if (cancelled) return;
    if (timer) clearTimeout(timer);

    let supported = false;
    try {
      supported = (track.getCapabilities() as TorchCapabilities).torch === true;
    } catch {
      // Some browsers throw before the track is live — indistinguishable from
      // "not ready", so it is retried rather than treated as a verdict.
      supported = false;
    }

    if (supported) {
      onResult(true);
      return;
    }
    onResult(false);
    if (track.readyState === 'ended' || Date.now() >= deadline) return;
    timer = setTimeout(read, TORCH_DETECT_POLL_MS);
  };

  read();
  // Frames starting is the event we are really waiting for; the poll is the
  // fallback for browsers that never fire it.
  track.addEventListener?.('unmute', read);

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    track.removeEventListener?.('unmute', read);
  };
}

export function useTorch(stream: MediaStream | null): {
  /** The device can toggle the torch on this stream. */
  hasTorch: boolean;
  torch: boolean;
  toggleTorch: () => void;
} {
  const [hasTorch, setHasTorch] = useState(false);
  const [torch, setTorch] = useState(false);

  // Re-detect per stream: the capability belongs to the track, and flipping
  // between the front and rear camera swaps it (front cameras rarely have a
  // flash unit).
  //
  // Detection RETRIES, and that is the whole point. A track is handed back
  // `live` before the camera has actually started producing frames, and until
  // it does, Chrome on Android reports capabilities WITHOUT `torch` — no error,
  // just a missing key. Reading once at the moment the stream arrives is
  // therefore the least likely moment to get an answer, and with no re-check
  // the button stayed hidden for the rest of the session on hardware that has
  // a flash. Poll briefly instead, and stop at the first positive answer.
  //
  // A negative answer is never cached as final until the window closes, but a
  // positive one is: capabilities do not un-appear.
  useEffect(() => {
    setTorch(false);
    return watchTorchSupport(videoTrack(stream), setHasTorch);
  }, [stream]);

  const toggleTorch = useCallback(() => {
    const track = videoTrack(stream);
    if (!track) return;
    const next = !torch;
    // Optimistic, then reconciled: applyConstraints is async and a failure
    // must not leave the button lit while the lamp is dark.
    setTorch(next);
    track
      .applyConstraints({ advanced: [{ torch: next } as TorchConstraint] })
      .catch(() => {
        setTorch(false);
        setHasTorch(false);
      });
  }, [stream, torch]);

  // Leaving the torch burning after the step unmounts would drain the battery
  // and look like a bug in the host app.
  useEffect(() => {
    const track = videoTrack(stream);
    return () => {
      if (!track) return;
      track
        .applyConstraints({ advanced: [{ torch: false } as TorchConstraint] })
        .catch(() => undefined);
    };
  }, [stream]);

  return { hasTorch, torch, toggleTorch };
}
