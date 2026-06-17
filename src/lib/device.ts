// Device-class detection used to decide whether to offer the "continue on your
// phone" handoff. Handoff only makes sense on a desktop/laptop (the phone is
// the handoff *target*), so we suppress it on touch/mobile devices.

/**
 * Heuristic for "this is a desktop/laptop". True when the primary pointer is
 * fine (mouse/trackpad), the device isn't touch-primary, and the viewport is
 * wide. Returns false during SSR (no `window`).
 */
export function isDesktopDevice(): boolean {
  if (typeof window === 'undefined') return false;

  const mql = window.matchMedia?.bind(window);
  const finePointer = mql?.('(pointer: fine)')?.matches ?? false;
  const coarsePointer = mql?.('(pointer: coarse)')?.matches ?? false;
  const hasTouch =
    'ontouchstart' in window || (typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0);
  const wideViewport = window.innerWidth >= 1024;

  // A touch device whose primary pointer is coarse is a phone/tablet — never a
  // handoff *source*, even if a mouse happens to be attached.
  if (coarsePointer && hasTouch) return false;

  return finePointer && wideViewport;
}

/**
 * Best-effort check for "this device has no camera". `enumerateDevices()`
 * reports `videoinput` entries even before camera permission is granted (labels
 * are empty, but the kind is present), so we can detect *presence* without
 * prompting. Returns false (assume a camera might exist) when the API is
 * unavailable or throws — we never want a false "no camera" to over-push the QR.
 */
export async function hasNoWebcam(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return false;
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return !devices.some((d) => d.kind === 'videoinput');
  } catch {
    return false;
  }
}
