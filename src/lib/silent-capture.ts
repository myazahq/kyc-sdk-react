// ─── Silent capture ──────────────────────────────────────────────────────────
//
// Up to three unposed photos of the applicant, taken during DOCUMENT CAPTURE
// only (never on the liveness step), from a document camera that faces the
// person: a laptop webcam. No extra permission prompt, no visible UI, no sound,
// no flash, no delay to the flow. A reviewer sees who was holding the ID.
// A phone's rear camera sees only the document, so a phone browser takes none.
//
// This file is the pure half (which captures apply, the caps, the wire shape);
// the frame grabbing lives in hooks/useSilentCapture.ts and the per-session
// record in lib/silent-capture-store.ts.
//
// Wire contract (server): each frame uploads as media type `silent_capture`
// (JPEG) and rides the verify submission as `mediaIds.silentCapture1..3`,
// numbered by capture order with no gaps, described by
// `metadata.device.silentCapture = [{ slot, moment, capturedAt }]`.
// The workflow flag `silentCapture` is ON unless it is exactly `false`.

import { configScope, type WorkflowScope } from './scope';

/** When a frame was taken. Only document capture takes them now; the wire
 *  vocabulary also has `'selfie'`, which older SDK builds still send. */
export type SilentCaptureMoment = 'document';

/** At most this many frames per verification, whatever moments took them. */
export const SILENT_CAPTURE_LIMIT = 3;

/** When a document camera session takes its frame, counted from the stream
 *  going live. One frame per session: a two-sided document gives two, and a
 *  retake can add one more before the limit. */
export const DOCUMENT_FRAME_DELAY_MS = 1500;

/** Longest edge of a stored frame, and its JPEG quality. */
export const SILENT_FRAME_MAX_EDGE = 640;
export const SILENT_FRAME_QUALITY = 0.7;

/** A frame taken this session. `mediaId` is set once its upload succeeded. */
export interface SilentFrame {
  moment: SilentCaptureMoment;
  capturedAt: string;
  mediaId?: string;
}

/** One entry of `metadata.device.silentCapture`. */
export interface SilentCaptureEntry {
  slot: number;
  moment: SilentCaptureMoment;
  capturedAt: string;
}

export interface SilentCaptureConfig {
  silentCapture?: boolean | null;
  previewMode?: boolean;
  scope?: WorkflowScope | string;
}

/**
 * Whether silent capture runs for this flow. Never in the builder preview,
 * never when the workflow switched it off, and never on a scoped flow: none of
 * them captures a document.
 */
export function silentCaptureApplies(config: SilentCaptureConfig): boolean {
  if (config.previewMode) return false;
  if (config.silentCapture === false) return false;
  return configScope(config) === null;
}

/** Whether another frame may be taken, given those already taken. */
export function canTakeSilentFrame(frames: readonly SilentFrame[]): boolean {
  return frames.length < SILENT_CAPTURE_LIMIT;
}

export interface SilentCaptureSubmission {
  /** `silentCapture1..n`, keyed for the verify request's `mediaIds`. */
  mediaIds: Record<string, string>;
  /** The matching `metadata.device.silentCapture` entries (empty when none). */
  device: SilentCaptureEntry[];
}

/**
 * The submission for the frames that actually uploaded: renumbered 1..n in
 * capture order, so a failed upload leaves no gap.
 */
export function buildSilentCaptureSubmission(frames: readonly SilentFrame[]): SilentCaptureSubmission {
  const mediaIds: Record<string, string> = {};
  const device: SilentCaptureEntry[] = [];
  for (const frame of frames) {
    if (!frame.mediaId || device.length >= SILENT_CAPTURE_LIMIT) continue;
    const slot = device.length + 1;
    mediaIds[`silentCapture${slot}`] = frame.mediaId;
    device.push({ slot, moment: frame.moment, capturedAt: frame.capturedAt });
  }
  return { mediaIds, device };
}

/**
 * Add the frames' description to an already-built device block. Returns the
 * block unchanged when nothing uploaded, so a submission without frames says
 * nothing about silent capture at all.
 */
export function withSilentCaptureDevice<T extends Record<string, unknown> | undefined>(
  device: T,
  entries: SilentCaptureEntry[],
): T | Record<string, unknown> {
  if (entries.length === 0) return device;
  return { ...(device ?? {}), silentCapture: entries };
}

/** The stored size of a frame: scaled down to the long-edge cap, never up. */
export function silentFrameSize(width: number, height: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= SILENT_FRAME_MAX_EDGE || longest <= 0) return { width, height };
  const scale = SILENT_FRAME_MAX_EDGE / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
