'use client';

import { createContext, useContext } from 'react';

/**
 * Whether the modal should light the screen for the camera.
 *
 * The dialog's backdrop turns WHITE on capture steps so the display itself
 * lights the subject's face — on desktop the modal covers a fraction of the
 * screen, so the surrounding backdrop is most of the available light.
 *
 * Flash liveness does not want that for the whole step. The flash sequence
 * emits its own colours and measures the face's reflection of them, so a
 * constant white field before and after the sequence buys nothing and arrives
 * as a jarring full-screen flash the moment the step opens (worst in dark
 * mode). The step therefore OVERRIDES the default while it is in flash mode
 * and asks for light only while the sequence runs.
 *
 * `null` means "no opinion, use the step default" — which is what every other
 * capture step wants.
 */
export const CaptureLightContext = createContext<(bright: boolean | null) => void>(() => {});

export function useSetCaptureLight(): (bright: boolean | null) => void {
  return useContext(CaptureLightContext);
}
