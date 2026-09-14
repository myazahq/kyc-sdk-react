// ─── Was the selfie sharp enough? Measured the moment it is taken ────────────
//
// The server can already say a failed face check was caused by a blurry
// selfie, but that reaches the applicant by webhook minutes later, when the
// phone is back in a pocket. The review screen is the one place a retake costs
// two seconds, so the same question is asked here.
//
// Mirrored by the React Native SDK's lib/selfie-sharpness.ts and the Flutter
// SDK's utils/selfie_sharpness.dart. Keep the floor, the crop fraction and the
// measuring size in lockstep, or one score means three different things.
//
// A NOTICE, NEVER A GATE. The floor below was not calibrated on real browser
// captures, and a wrong floor on a gate would trap a genuine applicant in a
// retake loop. As a notice the cost of a wrong floor is one sentence the
// applicant can ignore: Continue stays available whatever this says. It is the
// same rule the server follows, where capture quality explains a failure and
// never causes one.
//
// MEASURED ON THE FACE, NOT THE FRAME. A selfie is a face in a room, and a
// whole-frame focus measure scores the room. Auto-capture only fires once the
// face is centred and fills 28 to 70 per cent of the frame width (see
// liveness/gesture-detector/position.ts), so the centre of the still IS the
// face, and a centre crop measures it without needing the landmarks here.
//
// The maths is pure and synchronous so it is testable without a browser; the
// canvas decode is a thin wrapper that returns null wherever canvas is missing.

/** Below this, the notice shows. A starting value, biased toward NOT showing. */
export const SELFIE_SHARPNESS_FLOOR = 18;

/** Share of the shorter side the centre crop takes. */
const CROP_FRACTION = 0.5;

/**
 * The crop is redrawn at a FIXED size before measuring, because Laplacian
 * variance scales with resolution: without it the score would measure the
 * phone's camera rather than the photograph.
 */
const MEASURE_SIZE = 160;

/**
 * Variance of the 4-neighbour Laplacian over a single-channel plane.
 *
 * Blur is a low-pass filter, so it flattens second derivatives, so the spread
 * of the Laplacian response collapses. Variance rather than mean, because the
 * mean of a Laplacian is near zero on any image, sharp or not. The same
 * measure the server runs, so the two readings can be compared.
 */
export function laplacianVariance(gray: ArrayLike<number>, width: number, height: number): number {
  // Interior pixels only: the kernel needs all four neighbours.
  if (width < 3 || height < 3 || gray.length < width * height) return 0;

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y += 1) {
    const row = y * width;
    for (let x = 1; x < width - 1; x += 1) {
      const i = row + x;
      const v = gray[i - width]! + gray[i + width]! + gray[i - 1]! + gray[i + 1]! - 4 * gray[i]!;
      sum += v;
      sumSq += v * v;
      n += 1;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return Math.round((sumSq / n - mean * mean) * 100) / 100;
}

/** A centred square covering `fraction` of the shorter side. */
export function centreCrop(
  width: number,
  height: number,
  fraction: number = CROP_FRACTION,
): { sx: number; sy: number; sw: number; sh: number } {
  const side = Math.max(1, Math.round(Math.min(width, height) * fraction));
  return {
    sx: Math.max(0, Math.round((width - side) / 2)),
    sy: Math.max(0, Math.round((height - side) / 2)),
    sw: side,
    sh: side,
  };
}

/**
 * Whether to show the notice. An unmeasurable selfie is NOT blurry: "we could
 * not look" is not evidence the photograph was soft, and saying so would ask a
 * person to retake a photo that may be perfectly good.
 */
export function isSelfieBlurry(score: number | null): boolean {
  return score != null && score < SELFIE_SHARPNESS_FLOOR;
}

/** Decode the still and measure its centre. Null on any failure. */
export async function measureSelfieSharpness(dataUrl: string): Promise<number | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('selfie did not decode'));
      img.src = dataUrl;
    });
    if (!img.naturalWidth || !img.naturalHeight) return null;

    const canvas = document.createElement('canvas');
    canvas.width = MEASURE_SIZE;
    canvas.height = MEASURE_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const c = centreCrop(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, 0, 0, MEASURE_SIZE, MEASURE_SIZE);
    const { data } = ctx.getImageData(0, 0, MEASURE_SIZE, MEASURE_SIZE);

    const gray = new Uint8Array(MEASURE_SIZE * MEASURE_SIZE);
    for (let p = 0, i = 0; p < gray.length; p += 1, i += 4) {
      gray[p] = Math.round(0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!);
    }
    return laplacianVariance(gray, MEASURE_SIZE, MEASURE_SIZE);
  } catch {
    return null;
  }
}
