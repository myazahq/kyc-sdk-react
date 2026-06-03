'use client';

import { useCallback } from 'react';
import { SELFIE_IMAGE_QUALITY } from '../lib/capture-settings';

export interface UseImageCaptureOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  mirror?: boolean;
}

export interface UseImageCaptureReturn {
  capture: () => string | null;
}

export function useImageCapture({
  videoRef,
  mirror = false,
}: UseImageCaptureOptions): UseImageCaptureReturn {
  const capture = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < video.HAVE_CURRENT_DATA) return null;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Selfie still: moderate JPEG quality — plenty for facial comparison.
    return canvas.toDataURL('image/jpeg', SELFIE_IMAGE_QUALITY);
  }, [videoRef, mirror]);

  return { capture };
}
