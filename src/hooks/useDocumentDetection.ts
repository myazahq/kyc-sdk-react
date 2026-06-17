'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { compressDocumentImage } from '../utils/image';
import { DOCUMENT_IMAGE_QUALITY, logCaptureSize } from '../lib/capture-settings';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Target aspect ratio. Most supported documents are ISO/IEC 7810 ID-1 cards
 * (85.60 mm × 53.98 mm ≈ 1.586); passport data pages are a bit squarer (~1.42).
 * We aim between them and accept a band that covers both, but NOT portrait
 * shapes (a head/face crop is roughly square-to-portrait, ratio ≲ 1.1).
 */
const RATIO_TARGET = 1.55;
const RATIO_TOLERANCE = 0.4; // accepts ~1.15 – 1.95 (landscape only)

/** Card bounding box must cover this fraction of the frame (area). */
const MIN_AREA_FRACTION = 0.1;
const MAX_AREA_FRACTION = 0.95;

/** Minimum separation between a border pair, as a fraction of the frame. */
const MIN_WIDTH_FRACTION = 0.3;
const MIN_HEIGHT_FRACTION = 0.18;

/**
 * The KEY discriminator between a card and a face: every one of the four
 * borders must be a *continuous, straight, high-contrast line*. Each side must
 * have at least this fraction of its length covered by strong edge pixels.
 * A face's bounding box has, at best, one or two coincidental straight sides —
 * never four — so it can no longer pass.
 */
const BORDER_MIN_FILL = 0.55;

/** A projection peak must reach this fraction of the strongest peak to count. */
const PEAK_REL_THRESHOLD = 0.32;
/** Cap candidate border lines per axis (keeps the rectangle search cheap). */
const MAX_PEAKS = 6;

/** How many *consecutive* frames a candidate must survive before "detected". */
const DETECT_CONFIRM_FRAMES = 3;

/** A detected card is "stable" when it hasn't moved more than this fraction
 *  of the video dimension in either axis. */
const STABILITY_FRACTION = 0.07;

/** How long the card must be stable before we auto-capture. */
const STABILITY_DURATION_MS = 750;

/** Fallback: capture the full frame after this many ms even if detection never
 *  triggers — ensures the user is never stuck waiting forever. */
const FALLBACK_CAPTURE_MS = 6000;

/** Detection resolution. A bit higher than the old 160×100 so thin card
 *  borders survive the downscale and read as clean straight lines. */
const DETECT_W = 240;
const DETECT_H = 150;

/** Throttle detection to ~16 fps — plenty for guidance, far gentler on the CPU
 *  than running edge detection on every animation frame. */
const MIN_PROCESS_INTERVAL_MS = 60;

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

interface DetectRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

// ---------------------------------------------------------------------------
// Image-processing helpers (pure, no external deps)
// ---------------------------------------------------------------------------

/**
 * Convert RGBA ImageData to a grayscale Float32Array.
 * Uses the standard luminance formula: 0.299R + 0.587G + 0.114B.
 */
function toGrayscale(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const off = i * 4;
    gray[i] = 0.299 * data[off] + 0.587 * data[off + 1] + 0.114 * data[off + 2];
  }
  return gray;
}

/**
 * Compute the *directional* Sobel response, separated into:
 *   • `gx` — magnitude of the horizontal derivative → responds to VERTICAL edges
 *            (the left/right borders of a card).
 *   • `gy` — magnitude of the vertical derivative → responds to HORIZONTAL edges
 *            (the top/bottom borders of a card).
 * Keeping the two directions apart is what lets us look for four straight
 * borders independently instead of one undifferentiated blob of "edginess".
 */
function directionalSobel(
  gray: Float32Array,
  w: number,
  h: number,
): { gx: Float32Array; gy: Float32Array } {
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
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

      const sx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const sy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      const idx = y * w + x;
      gx[idx] = sx < 0 ? -sx : sx;
      gy[idx] = sy < 0 ? -sy : sy;
    }
  }
  return { gx, gy };
}

/** Mean + standard deviation of a Float32Array in a single pass. */
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

/** 3-tap moving average to smooth a projection array in-place. */
function smooth3(arr: Float32Array): void {
  let prev = arr[0];
  for (let i = 1; i < arr.length - 1; i++) {
    const cur = arr[i];
    arr[i] = (prev + cur + arr[i + 1]) / 3;
    prev = cur;
  }
}

/**
 * Find the strongest, well-separated local maxima in a projection — these are
 * the candidate border lines. Returns positions sorted ascending.
 */
function findPeaks(proj: Float32Array): number[] {
  const n = proj.length;
  let max = 0;
  for (let i = 0; i < n; i++) if (proj[i] > max) max = proj[i];
  if (max <= 0) return [];

  const thresh = max * PEAK_REL_THRESHOLD;
  const candidates: { pos: number; val: number }[] = [];
  for (let i = 0; i < n; i++) {
    const v = proj[i];
    if (v < thresh) continue;
    const prev = i > 0 ? proj[i - 1] : -Infinity;
    const next = i < n - 1 ? proj[i + 1] : -Infinity;
    if (v >= prev && v >= next) candidates.push({ pos: i, val: v });
  }

  // Greedily keep the strongest peaks, suppressing any within a few pixels of an
  // already-chosen one (avoids counting one thick border as two lines).
  candidates.sort((a, b) => b.val - a.val);
  const chosen: number[] = [];
  const minSep = 3;
  for (const c of candidates) {
    if (chosen.every((p) => Math.abs(p - c.pos) >= minSep)) {
      chosen.push(c.pos);
      if (chosen.length >= MAX_PEAKS) break;
    }
  }
  return chosen.sort((a, b) => a - b);
}

/**
 * Fraction of a horizontal line (row `r`, columns `left..right`) covered by
 * strong horizontal-edge pixels. Checks r-1/r/r+1 and takes the best, so a
 * border that lands between downscaled pixels still reads as continuous.
 */
function horizontalFill(
  gy: Float32Array,
  r: number,
  left: number,
  right: number,
  w: number,
  h: number,
  thresh: number,
): number {
  const span = right - left + 1;
  if (span <= 0) return 0;
  let best = 0;
  for (let rr = r - 1; rr <= r + 1; rr++) {
    if (rr < 0 || rr >= h) continue;
    let count = 0;
    const base = rr * w;
    for (let x = left; x <= right; x++) if (gy[base + x] > thresh) count++;
    const frac = count / span;
    if (frac > best) best = frac;
  }
  return best;
}

/**
 * Fraction of a vertical line (column `c`, rows `top..bottom`) covered by strong
 * vertical-edge pixels. Checks c-1/c/c+1 and takes the best.
 */
function verticalFill(
  gx: Float32Array,
  c: number,
  top: number,
  bottom: number,
  w: number,
  h: number,
  thresh: number,
): number {
  const span = bottom - top + 1;
  if (span <= 0) return 0;
  let best = 0;
  for (let cc = c - 1; cc <= c + 1; cc++) {
    if (cc < 0 || cc >= w) continue;
    let count = 0;
    for (let y = top; y <= bottom; y++) if (gx[y * w + cc] > thresh) count++;
    const frac = count / span;
    if (frac > best) best = frac;
  }
  return best;
}

/**
 * Find the best card-shaped rectangle whose four sides are all continuous
 * straight borders. Returns bounds in detection-canvas coordinates, or null.
 *
 * Strategy:
 *   1. Top/bottom borders are horizontal lines → peaks in the row projection of
 *      |gy|. Left/right borders are vertical lines → peaks in the column
 *      projection of |gx|.
 *   2. For every pair of horizontal peaks × pair of vertical peaks, form a
 *      rectangle, cheaply reject on aspect ratio + area, then require ALL FOUR
 *      sides to be continuous high-contrast borders (the face-rejecting gate).
 *   3. Score the survivors and return the best.
 */
function findCardBounds(gx: Float32Array, gy: Float32Array, w: number, h: number): DetectRect | null {
  // Per-axis edge thresholds — a pixel counts as a "strong" border pixel when it
  // sits clearly above the frame's typical gradient.
  const sx = meanStd(gx);
  const sy = meanStd(gy);
  const vThresh = sx.mean + 0.6 * sx.std; // for vertical (left/right) borders
  const hThresh = sy.mean + 0.6 * sy.std; // for horizontal (top/bottom) borders

  // Row projection of horizontal-edge energy, column projection of vertical-edge
  // energy. Each card border concentrates into a sharp peak here.
  const rowProj = new Float32Array(h);
  const colProj = new Float32Array(w);
  for (let y = 0; y < h; y++) {
    const base = y * w;
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += gy[base + x];
      colProj[x] += gx[base + x];
    }
    rowProj[y] = rowSum;
  }
  smooth3(rowProj);
  smooth3(colProj);

  const hPeaks = findPeaks(rowProj); // candidate top/bottom rows
  const vPeaks = findPeaks(colProj); // candidate left/right cols
  if (hPeaks.length < 2 || vPeaks.length < 2) return null;

  const minH = MIN_HEIGHT_FRACTION * h;
  const minW = MIN_WIDTH_FRACTION * w;
  const frameArea = w * h;

  let best: DetectRect | null = null;
  let bestScore = -1;

  for (let a = 0; a < hPeaks.length; a++) {
    const top = hPeaks[a];
    for (let b = a + 1; b < hPeaks.length; b++) {
      const bottom = hPeaks[b];
      const bh = bottom - top;
      if (bh < minH) continue;

      for (let c = 0; c < vPeaks.length; c++) {
        const left = vPeaks[c];
        for (let d = c + 1; d < vPeaks.length; d++) {
          const right = vPeaks[d];
          const bw = right - left;
          if (bw < minW) continue;

          // Cheap geometric rejects first.
          const ratio = bw / bh;
          if (Math.abs(ratio - RATIO_TARGET) > RATIO_TOLERANCE) continue;
          const areaFrac = (bw * bh) / frameArea;
          if (areaFrac < MIN_AREA_FRACTION || areaFrac > MAX_AREA_FRACTION) continue;

          // The expensive, decisive test: are all four sides real borders?
          const tf = horizontalFill(gy, top, left, right, w, h, hThresh);
          if (tf < BORDER_MIN_FILL) continue;
          const bf = horizontalFill(gy, bottom, left, right, w, h, hThresh);
          if (bf < BORDER_MIN_FILL) continue;
          const lf = verticalFill(gx, left, top, bottom, w, h, vThresh);
          if (lf < BORDER_MIN_FILL) continue;
          const rf = verticalFill(gx, right, top, bottom, w, h, vThresh);
          if (rf < BORDER_MIN_FILL) continue;

          const minFill = Math.min(tf, bf, lf, rf);
          const avgFill = (tf + bf + lf + rf) / 4;

          // Prefer a well-centered candidate (correlates with the on-screen
          // guide frame) and a fuller rectangle.
          const cx = (left + right) / 2 / w;
          const cy = (top + bottom) / 2 / h;
          const centerDist = Math.hypot(cx - 0.5, cy - 0.5);
          const centerBonus = 0.15 * (1 - Math.min(centerDist / 0.5, 1));

          const score = minFill * 0.6 + avgFill * 0.25 + centerBonus;
          if (score > bestScore) {
            bestScore = score;
            best = { top, bottom, left, right };
          }
        }
      }
    }
  }

  return best;
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
  const lastProcessRef = useRef(0);

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

    // Throttle the (relatively heavy) edge detection — guidance doesn't need to
    // run on every single animation frame.
    const now = performance.now();
    if (now - lastProcessRef.current < MIN_PROCESS_INTERVAL_MS) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }
    lastProcessRef.current = now;

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

    // Directional edges → find a four-bordered card rectangle
    const gray = toGrayscale(data, DETECT_W, DETECT_H);
    const { gx, gy } = directionalSobel(gray, DETECT_W, DETECT_H);
    const candidate = findCardBounds(gx, gy, DETECT_W, DETECT_H);

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
    const isStablePosition =
      last !== null &&
      Math.abs(bounds.x - last.x) < STABILITY_FRACTION * vw &&
      Math.abs(bounds.y - last.y) < STABILITY_FRACTION * vh &&
      Math.abs(bounds.width - last.width) < STABILITY_FRACTION * vw &&
      Math.abs(bounds.height - last.height) < STABILITY_FRACTION * vh;

    lastBoundsRef.current = bounds;

    if (isStablePosition) {
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
    // no card was ever detected — don't capture a blank background or a face.
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
    lastProcessRef.current = 0;
    setIsCardDetected(false);
    setIsStable(false);
    setCardBounds(null);
    setCapturedImage(null);
  }, []);

  return { isCardDetected, isStable, cardBounds, capturedImage, reset };
}
