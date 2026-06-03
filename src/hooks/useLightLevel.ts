'use client';

import { useEffect, useState } from 'react';

const SAMPLE_W = 64;
const SAMPLE_H = 48;
const SAMPLE_INTERVAL_MS = 800;
// Camera needs ~1.5s to auto-expose before we trust readings
const WARMUP_MS = 1500;
// Must be dim for this many consecutive readings before flagging
const CONFIRM_READINGS = 2;
// 0–255 average luminance threshold
const DIM_THRESHOLD = 62;

/**
 * Periodically samples the video feed and returns whether the environment
 * is too dim for reliable capture. Uses a confirmation gate to avoid
 * flickering when the camera is still auto-exposing.
 */
export function useLightLevel(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): { isDim: boolean } {
  const [dimCount, setDimCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;

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
        setDimCount((prev) =>
          brightness < DIM_THRESHOLD ? Math.min(prev + 1, CONFIRM_READINGS + 1) : 0,
        );
      }, SAMPLE_INTERVAL_MS);
    }, WARMUP_MS);

    return () => {
      clearTimeout(warmupId);
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [enabled, videoRef]);

  // When disabled, never report dim (stale dimCount is irrelevant)
  return { isDim: enabled && dimCount >= CONFIRM_READINGS };
}
