// ---------------------------------------------------------------------------
// MediaPipe Face Mesh loader
// Loads the model from CDN — does NOT bundle the ~4MB WASM/model files.
// ---------------------------------------------------------------------------

import type { NormalizedLandmark } from './types';

// ---------------------------------------------------------------------------
// CDN base URL for MediaPipe Face Mesh model files
// ---------------------------------------------------------------------------

const FACE_MESH_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/';

// ---------------------------------------------------------------------------
// Types for the MediaPipe JS API (we only use what we need)
// ---------------------------------------------------------------------------

interface FaceMeshResults {
  multiFaceLandmarks?: NormalizedLandmark[][];
}

interface FaceMeshInstance {
  setOptions: (opts: Record<string, unknown>) => void;
  onResults: (callback: (results: FaceMeshResults) => void) => void;
  initialize: () => Promise<void>;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  close: () => void;
}

interface FaceMeshConstructor {
  new (config: { locateFile: (file: string) => string }): FaceMeshInstance;
}

// ---------------------------------------------------------------------------
// Singleton loader — ensures we only load the script once
// ---------------------------------------------------------------------------

let faceMeshConstructorPromise: Promise<FaceMeshConstructor> | null = null;

// ---------------------------------------------------------------------------
// Persistent warm instance — created once (at SDK load time via
// `primeFaceMesh()`) and reused for the lifetime of the page. The WASM model is
// expensive to initialize, so we never tear it down between liveness sessions;
// instead each session just attaches its own landmark callback and detaches it
// on close. This keeps re-entry (and retake) instant instead of re-loading the
// model every time.
// ---------------------------------------------------------------------------

let sharedInstance: FaceMeshInstance | null = null;
let sharedInitPromise: Promise<FaceMeshInstance> | null = null;

// The single active consumer's landmark callback. The instance's onResults
// dispatcher (installed once, below) forwards to whatever is set here. Only one
// liveness session runs at a time, so a single slot is enough.
//
// `faceCount` is the number of faces MediaPipe found in the frame — the liveness
// flow uses `> 1` to pause challenges ("Make sure only your face is visible").
type LandmarkCallback = (
  landmarks: NormalizedLandmark[] | null,
  faceCount: number,
) => void;

let activeCallback: LandmarkCallback | null = null;

function loadFaceMeshScript(): Promise<FaceMeshConstructor> {
  if (faceMeshConstructorPromise) return faceMeshConstructorPromise;

  faceMeshConstructorPromise = new Promise<FaceMeshConstructor>((resolve, reject) => {
    // Check if already loaded (e.g. from a previous session)
    if ((window as unknown as Record<string, unknown>).FaceMesh) {
      resolve((window as unknown as Record<string, unknown>).FaceMesh as unknown as FaceMeshConstructor);
      return;
    }

    const script = document.createElement('script');
    script.src = `${FACE_MESH_CDN}face_mesh.js`;
    script.async = true;
    script.onload = () => {
      const FM = (window as unknown as Record<string, unknown>).FaceMesh as unknown as FaceMeshConstructor | undefined;
      if (FM) {
        resolve(FM);
      } else {
        reject(new Error('FaceMesh not found on window after script load'));
      }
    };
    script.onerror = () => {
      faceMeshConstructorPromise = null; // Allow retry on next call
      reject(new Error('Failed to load MediaPipe Face Mesh from CDN'));
    };
    document.head.appendChild(script);
  });

  return faceMeshConstructorPromise;
}

// ---------------------------------------------------------------------------
// Shared options used for both prewarming and live instances
// ---------------------------------------------------------------------------

function applyOptions(instance: FaceMeshInstance) {
  instance.setOptions({
    // Detect up to 2 faces so the liveness flow can spot (and pause on) a second
    // person in frame. Only the largest/first face drives gesture detection.
    maxNumFaces: 2,
    refineLandmarks: true,
    minDetectionConfidence: 0.35,
    minTrackingConfidence: 0.35,
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FaceMeshHandle {
  /** Send a video frame for landmark detection */
  send: (video: HTMLVideoElement) => Promise<void>;
  /** Clean up resources */
  close: () => void;
}

/**
 * Build the shared FaceMesh instance once and initialize its WASM model. The
 * single `onResults` dispatcher forwards every frame's landmarks to the current
 * `activeCallback`, so individual sessions never need to re-register results or
 * re-initialize. Concurrent callers share the same in-flight promise.
 */
function ensureInstance(): Promise<FaceMeshInstance> {
  if (sharedInstance) return Promise.resolve(sharedInstance);
  if (sharedInitPromise) return sharedInitPromise;

  sharedInitPromise = (async () => {
    const FaceMesh = await loadFaceMeshScript();
    const instance = new FaceMesh({ locateFile: (f) => `${FACE_MESH_CDN}${f}` });
    applyOptions(instance);

    // Installed once for the instance's lifetime; routes to the active session.
    instance.onResults((results: FaceMeshResults) => {
      const cb = activeCallback;
      if (!cb) return; // no session attached — ignore stray frames
      const faces = results.multiFaceLandmarks ?? [];
      if (faces.length > 0) {
        cb(faces[0], faces.length);
      } else {
        cb(null, 0);
      }
    });

    try {
      await Promise.race([
        instance.initialize(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('MediaPipe initialize() timed out')), 25_000),
        ),
      ]);
    } catch (err) {
      // Init failed — tear down the partial instance and allow a later retry.
      try { instance.close(); } catch { /* ignore */ }
      sharedInstance = null;
      sharedInitPromise = null;
      faceMeshConstructorPromise = null;
      throw err;
    }

    sharedInstance = instance;
    return instance;
  })();

  return sharedInitPromise;
}

/**
 * Call this as early as possible (on SDK mount) to pre-load the MediaPipe
 * script and initialize the WASM model in the background. When the user reaches
 * the liveness step, `createFaceMesh` reuses the warm instance immediately
 * instead of waiting for the model to download.
 */
export function primeFaceMesh(): void {
  // Kick off (or reuse) the shared init; failures are retried on demand later.
  ensureInstance().catch(() => { /* prewarm is best-effort */ });
}

/**
 * Attach a liveness session to the shared FaceMesh instance. Reuses the
 * already-warm model (no re-initialization between sessions or retakes); if
 * priming hasn't finished, this awaits the same in-flight init.
 *
 * `close()` only detaches this session's callback — the warm instance is kept
 * alive for the next session.
 */
export async function createFaceMesh(
  onLandmarks: LandmarkCallback,
): Promise<FaceMeshHandle> {
  const instance = await ensureInstance();
  activeCallback = onLandmarks;

  return {
    send: (video: HTMLVideoElement) => instance.send({ image: video }),
    close: () => {
      // Detach only — keep the instance warm. Guard against clobbering a newer
      // session that may have attached in the meantime.
      if (activeCallback === onLandmarks) activeCallback = null;
    },
  };
}
