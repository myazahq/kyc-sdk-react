'use client';

import { useEffect, useState } from 'react';

const SAMPLE_W = 64;
const SAMPLE_H = 48;
const SAMPLE_INTERVAL_MS = 800;
// Camera needs ~1.5s to auto-expose before we trust readings
const WARMUP_MS = 1500;
// Must stay out-of-range for this many consecutive readings before flagging
const CONFIRM_READINGS = 2;

/**
 * Lighting thresholds on a 0–255 mean-luminance scale. Exported so they stay
 * the single source of truth and can be tuned in one place. Kept in sync with
 * the Flutter SDK's `_BrightnessSampler` (dark < 62, bright > 200).
 */
export const LIGHT_THRESHOLDS = {
  /** Below this mean luminance the scene is too dark. */
  dark: 62,
  /** Above this mean luminance the scene is overexposed / too bright. */
  bright: 200,
} as const;

/** Resolved lighting quality for the current camera feed. */
export type LightLevel = 'ok' | 'dark' | 'bright';

/**
 * Periodically samples the video feed and classifies the lighting as `ok`,
 * `dark`, or `bright`. Uses a confirmation gate (2 consecutive readings) to
 * avoid flickering while the camera auto-exposes. Returns `ok` when disabled.
 */
export function useLightLevel(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): { level: LightLevel } {
  // Signed streak: negative = consecutive dark readings, positive = bright.
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setStreak(0);
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_W;
    canvas.height = SAMPLE_H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const warmupId = setTimeout(() => {
      intervalId = setInterval(() => {
        const video = videoRef.current;
        if (!video || video.readyState < video.HAVE_CURRENT_DATA || video.paused) return;

        ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
        const { data } = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H);
        let sum = 0;
        const pixelCount = data.length / 4;
        for (let i = 0; i < data.length; i += 4) {
          // ITU-R BT.601 luminance
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        const brightness = sum / pixelCount;
        // setState called in a timer callback — allowed by react-hooks/set-state-in-effect
        setStreak((prev) => {
          if (brightness < LIGHT_THRESHOLDS.dark) {
            return Math.max(prev <= 0 ? prev - 1 : -1, -(CONFIRM_READINGS + 1));
          }
          if (brightness > LIGHT_THRESHOLDS.bright) {
            return Math.min(prev >= 0 ? prev + 1 : 1, CONFIRM_READINGS + 1);
          }
          return 0;
        });
      }, SAMPLE_INTERVAL_MS);
    }, WARMUP_MS);

    return () => {
      clearTimeout(warmupId);
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [enabled, videoRef]);

  let level: LightLevel = 'ok';
  if (enabled) {
    if (streak <= -CONFIRM_READINGS) level = 'dark';
    else if (streak >= CONFIRM_READINGS) level = 'bright';
  }
  return { level };
}
