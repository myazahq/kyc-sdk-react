'use client';

import { createContext, useContext, useEffect } from 'react';

/**
 * The liveness step tells the modal when its CAMERA SCREEN is showing, so the
 * modal can hold the flow on its light palette (lib/liveness-bright-screen.ts).
 * A report is latched by the modal for the rest of the step: the review screen
 * after the capture stays light, so the theme changes once on the way in and
 * once on the way out rather than flickering between screens.
 */
export const LivenessCameraContext = createContext<() => void>(() => {});

/** Report the camera screen as shown while `shown` is true. */
export function useReportLivenessCamera(shown: boolean): void {
  const report = useContext(LivenessCameraContext);
  useEffect(() => {
    if (shown) report();
  }, [shown, report]);
}
