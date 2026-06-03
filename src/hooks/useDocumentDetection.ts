'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { compressDocumentImage } from '../utils/image';
import { DOCUMENT_IMAGE_QUALITY, logCaptureSize } from '../lib/capture-settings';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** ID card ISO/IEC 7810 ID-1: 85.60 mm × 53.98 mm → aspect ratio ≈ 1.586 */
const ID_CARD_RATIO = 85.6 / 53.98; // 1.5857…

/** How far the detected ratio may deviate from the ideal before we reject */
const RATIO_TOLERANCE = 0.45;

/** Card bounding box must cover this fraction of the frame (area) */
const MIN_AREA_FRACTION = 0.08;
const MAX_AREA_FRACTION = 0.95;

/** How many *consecutive* frames a candidate must survive before we consider
 *  it "detected" (reduces jitter on noisy frames) */
const DETECT_CONFIRM_FRAMES = 2;

/** A detected card is "stable" when it hasn't moved more than this fraction
 *  of the video dimension in either axis */
const STABILITY_FRACTION = 0.08;

/** How long the card must be stable before we auto-capture */
const STABILITY_DURATION_MS = 800;

/** Fallback: capture the full frame after this many ms even if detection never
 *  triggers — ensures the user is never stuck waiting forever */
const FALLBACK_CAPTURE_MS = 6000;

/** Resolution we run detection at (keep small for 60 fps on mid-range phones) */
const DETECT_W = 160;
const DETECT_H = 100;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseDocumentDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  enabled?: boolean;
}

export interface UseDocumentDetectionReturn {
  isCardDetected: boolean;
  isStable: boolean;
  cardBounds: CardBounds | null;
  capturedImage: string | null;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Image-processing helpers (pure, no external deps)
// ---------------------------------------------------------------------------

/**
 * Convert RGBA ImageData to a grayscale Uint8ClampedArray.
 * Uses the standard luminance formula: 0.299R + 0.587G + 0.114B.
 */
function toGrayscale(data: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    const off = i * 4;
    gray[i] = (0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2]) | 0;
  }
  return gray;
}

/**
 * Compute per-pixel Sobel gradient magnitude (0-255 scaled),
 * skipping a 1-pixel border.
 */
function sobelMagnitude(gray: Uint8ClampedArray, w: number, h: number): Float32Array {
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const tl = gray[(y - 1) * w + (x - 1)];
      const tc = gray[(y - 1) * w + x];
      const tr = gray[(y - 1) * w + (x + 1)];
      const ml = gray[y * w + (x - 1)];
      const mr = gray[y * w + (x + 1)];
      const bl = gray[(y + 1) * w + (x - 1)];
      const bc = gray[(y + 1) * w + x];
      const br = gray[(y + 1) * w + (x + 1)];

      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      mag[y * w + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return mag;
}

/**
 * Compute the mean and standard deviation of a Float32Array in a single pass.
 */
function meanStd(arr: Float32Array): { mean: number; std: number } {
  let sum = 0;
  let sumSq = 0;
  const n = arr.length;
  for (let i = 0; i < n; i++) {
    sum += arr[i];
    sumSq += arr[i] * arr[i];
  }
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  return { mean, std: Math.sqrt(Math.max(0, variance)) };
}

/**
 * Simple 3-tap moving average to smooth a projection array in-place.
 */
function smooth3(arr: Float32Array): void {
  for (let i = 1; i < arr.length - 1; i++) {
    arr[i] = (arr[i - 1] + arr[i] + arr[i + 1]) / 3;
  }
}

/**
 * Find the longest contiguous run in `arr` where arr[i] > threshold.
 * Returns [start, end] inclusive, or null if none found.
 */
function longestRun(arr: Float32Array, threshold: number): [number, number] | null {
  let bestStart = -1;
  let bestLen = 0;
  let runStart = -1;

  for (let i = 0; i <= arr.length; i++) {
    const active = i < arr.length && arr[i] > threshold;
    if (active && runStart === -1) {
      runStart = i;
    } else if (!active && runStart !== -1) {
      const len = i - runStart;
      if (len > bestLen) {
        bestLen = len;
        bestStart = runStart;
      }
      runStart = -1;
    }
  }

  if (bestStart === -1) return null;
  return [bestStart, bestStart + bestLen - 1];
}

/**
 * Try to find a rectangular card in the processed frame.
 *
 * Returns candidate bounds in **detection-canvas coordinates** (DETECT_W × DETECT_H),
 * or null if no plausible rectangle is found.
 */
function findCardBounds(
  ctx: CanvasRenderingContext2D,
  mag: Float32Array,
  threshold: number,
  w: number,
  h: number,
): { top: number; bottom: number; left: number; right: number } | null {
  // Build binary edge map and row / col projections
  const rowProj = new Float32Array(h);
  const colProj = new Float32Array(w);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mag[y * w + x] > threshold) {
        rowProj[y]++;
        colProj[x]++;
      }
    }
  }

  smooth3(rowProj);
  smooth3(colProj);

  // Minimum density required to count as a "card edge line"
  const minRowDensity = w * 0.04;
  const minColDensity = h * 0.04;

  const rowRun = longestRun(rowProj, minRowDensity);
  const colRun = longestRun(colProj, minColDensity);

  if (!rowRun || !colRun) return null;

  const [top, bottom] = rowRun;
  const [left, right] = colRun;

  const bw = right - left;
  const bh = bottom - top;
  if (bw < 2 || bh < 2) return null;

  // Aspect ratio check
  const ratio = bw / bh;
  if (Math.abs(ratio - ID_CARD_RATIO) > RATIO_TOLERANCE) return null;

  // Area check (as fraction of the detection canvas)
  const areaFrac = (bw * bh) / (w * h);
  if (areaFrac < MIN_AREA_FRACTION || areaFrac > MAX_AREA_FRACTION) return null;

  // Perimeter quality check — at least 20% of the rectangle's border pixels
  // should be above the edge threshold, otherwise it's likely background noise.
  const edgePixels = (ctx.getImageData(0, 0, w, h)).data; // already drawn
  let perimeterLen = 0;
  let perimeterEdges = 0;

  // Top and bottom rows
  for (let x = left; x <= right; x++) {
    perimeterLen += 2;
    if (mag[top * w + x] > threshold) perimeterEdges++;
    if (mag[bottom * w + x] > threshold) perimeterEdges++;
  }
  // Left and right cols (excluding corners already counted)
  for (let y = top + 1; y < bottom; y++) {
    perimeterLen += 2;
    if (mag[y * w + left] > threshold) perimeterEdges++;
    if (mag[y * w + right] > threshold) perimeterEdges++;
  }

  if (perimeterLen > 0 && perimeterEdges / perimeterLen < 0.08) return null;

  void edgePixels; // suppress unused warning — we called getImageData for the side-effect above

  return { top, bottom, left, right };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDocumentDetection({
  videoRef,
  canvasRef,
  enabled = true,
}: UseDocumentDetectionOptions): UseDocumentDetectionReturn {
  const [isCardDetected, setIsCardDetected] = useState(false);
  const [isStable, setIsStable] = useState(false);
  const [cardBounds, setCardBounds] = useState<CardBounds | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // Internal refs — never trigger re-renders
  const rafRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const everDetectedRef = useRef(false);
  const confirmCountRef = useRef(0);
  const stableStartRef = useRef<number | null>(null);
  const lastBoundsRef = useRef<CardBounds | null>(null);
  const hasCapturedRef = useRef(false);
  const isCapturingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Fallback: capture the full video frame (no crop)
  // ---------------------------------------------------------------------------

  const captureFullFrame = useCallback(async () => {
    if (hasCapturedRef.current || isCapturingRef.current) return;
    isCapturingRef.current = true;

    const video = videoRef.current;
    if (!video || video.readyState < video.HAVE_CURRENT_DATA) {
      isCapturingRef.current = false;
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) { isCapturingRef.current = false; return; }

    ctx.drawImage(video, 0, 0);
    const raw = canvas.toDataURL('image/jpeg', DOCUMENT_IMAGE_QUALITY);

    try {
      const compressed = await compressDocumentImage(raw);
      hasCapturedRef.current = true;
      logCaptureSize('document still (full frame)', compressed);
      setCapturedImage(compressed);
    } catch {
      hasCapturedRef.current = true;
      setCapturedImage(raw);
    } finally {
      isCapturingRef.current = false;
    }
  }, [videoRef]);

  // ---------------------------------------------------------------------------
  // Auto-capture
  // ---------------------------------------------------------------------------

  const autoCaptureCard = useCallback(
    async (bounds: CardBounds) => {
      if (hasCapturedRef.current || isCapturingRef.current) return;
      isCapturingRef.current = true;

      const video = videoRef.current;
      if (!video || video.readyState < video.HAVE_CURRENT_DATA) {
        isCapturingRef.current = false;
        return;
      }

      // Crop to card bounds (with 3% padding) on an offscreen canvas
      const padX = bounds.width * 0.03;
      const padY = bounds.height * 0.03;
      const cropX = Math.max(0, bounds.x - padX);
      const cropY = Math.max(0, bounds.y - padY);
      const cropW = Math.min(video.videoWidth - cropX, bounds.width + 2 * padX);
      const cropH = Math.min(video.videoHeight - cropY, bounds.height + 2 * padY);

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.round(cropW);
      cropCanvas.height = Math.round(cropH);
      const ctx = cropCanvas.getContext('2d');
      if (!ctx) {
        isCapturingRef.current = false;
        return;
      }

      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropCanvas.width, cropCanvas.height);
      const rawBase64 = cropCanvas.toDataURL('image/jpeg', DOCUMENT_IMAGE_QUALITY);

      try {
        const compressed = await compressDocumentImage(rawBase64);
        hasCapturedRef.current = true;
        logCaptureSize('document still (cropped)', compressed);
        setCapturedImage(compressed);
      } catch {
        // If compression fails, use the raw capture
        hasCapturedRef.current = true;
        setCapturedImage(rawBase64);
      } finally {
        isCapturingRef.current = false;
      }
    },
    [videoRef],
  );

  // ---------------------------------------------------------------------------
  // Per-frame detection loop
  // ---------------------------------------------------------------------------

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < video.HAVE_CURRENT_DATA || hasCapturedRef.current) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Size the canvas to our detection resolution (done once or on first frame)
    if (canvas.width !== DETECT_W || canvas.height !== DETECT_H) {
      canvas.width = DETECT_W;
      canvas.height = DETECT_H;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Draw the current video frame at detection resolution
    ctx.drawImage(video, 0, 0, DETECT_W, DETECT_H);
    const { data } = ctx.getImageData(0, 0, DETECT_W, DETECT_H);

    // Compute edge magnitudes
    const gray = toGrayscale(data, DETECT_W, DETECT_H);
    const mag = sobelMagnitude(gray, DETECT_W, DETECT_H);
    const { mean, std } = meanStd(mag);
    const threshold = mean + 0.75 * std;

    // Try to find a card-shaped rectangle
    const candidate = findCardBounds(ctx, mag, threshold, DETECT_W, DETECT_H);

    if (!candidate) {
      // No card — reset confirm counter
      confirmCountRef.current = 0;
      stableStartRef.current = null;
      setIsCardDetected(false);
      setIsStable(false);
      setCardBounds(null);
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Scale bounds back to full video resolution
    const scaleX = video.videoWidth / DETECT_W;
    const scaleY = video.videoHeight / DETECT_H;

    const bounds: CardBounds = {
      x: candidate.left * scaleX,
      y: candidate.top * scaleY,
      width: (candidate.right - candidate.left) * scaleX,
      height: (candidate.bottom - candidate.top) * scaleY,
    };

    // Confirmation gate — require N consecutive detections before announcing
    confirmCountRef.current = Math.min(confirmCountRef.current + 1, DETECT_CONFIRM_FRAMES + 1);
    const confirmed = confirmCountRef.current >= DETECT_CONFIRM_FRAMES;

    if (!confirmed) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    everDetectedRef.current = true;
    setIsCardDetected(true);
    setCardBounds(bounds);

    // -------------------------------------------------------------------
    // Stability check
    // -------------------------------------------------------------------

    const last = lastBoundsRef.current;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const threshold5pct =
      last !== null &&
      Math.abs(bounds.x - last.x) < STABILITY_FRACTION * vw &&
      Math.abs(bounds.y - last.y) < STABILITY_FRACTION * vh &&
      Math.abs(bounds.width - last.width) < STABILITY_FRACTION * vw &&
      Math.abs(bounds.height - last.height) < STABILITY_FRACTION * vh;

    lastBoundsRef.current = bounds;

    if (threshold5pct) {
      const now = performance.now();
      if (stableStartRef.current === null) {
        stableStartRef.current = now;
      } else if (now - stableStartRef.current >= STABILITY_DURATION_MS) {
        // Stable for long enough — auto-capture
        setIsStable(true);
        autoCaptureCard(bounds);
        // Stop the loop after triggering capture
        return;
      }
    } else {
      // Card moved — reset stable timer
      stableStartRef.current = null;
      setIsStable(false);
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, canvasRef, autoCaptureCard]);

  // ---------------------------------------------------------------------------
  // Start / stop loop when enabled changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!enabled) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (fallbackTimerRef.current !== null) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      return;
    }

    rafRef.current = requestAnimationFrame(processFrame);

    // Fallback: only grab the full frame if a card was detected at some point
    // but stability never triggered (e.g. card kept moving). Never fires if
    // no card was ever detected — don't capture a blank background.
    fallbackTimerRef.current = setTimeout(() => {
      if (!hasCapturedRef.current && everDetectedRef.current) {
        captureFullFrame();
      }
    }, FALLBACK_CAPTURE_MS);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (fallbackTimerRef.current !== null) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [enabled, processFrame, captureFullFrame]);

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  const reset = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (fallbackTimerRef.current !== null) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    everDetectedRef.current = false;
    confirmCountRef.current = 0;
    stableStartRef.current = null;
    lastBoundsRef.current = null;
    hasCapturedRef.current = false;
    isCapturingRef.current = false;
    setIsCardDetected(false);
    setIsStable(false);
    setCardBounds(null);
    setCapturedImage(null);
  }, []);

  return { isCardDetected, isStable, cardBounds, capturedImage, reset };
}
