'use client';

import { useEffect, useRef, useState } from 'react';
import { documentGuideRect } from '../../lib/document-guide';

// ─── Document ghost ─────────────────────────────────────────────────────────
//
// Port of the Flutter SDK's widgets/document_ghost.dart.
//
// A faint outline of the document's LAYOUT inside the capture guide, shown for
// a few seconds when the camera opens: where the portrait sits, where the
// printed details run, and — on a passport — the machine-readable band across
// the bottom.
//
// The guide rectangle says WHERE to put the document. It does not say which way
// round, and the commonest passport mistake is framing the page with the MRZ
// cropped off the bottom edge, which auto-capture then refuses because that
// band is the chip's key and the proof the page is a passport.
//
// Drawn as placeholder BARS and BLOCKS, never literal drawings. Flutter tried
// sketching a face from a circle and an arc first, which is a worse thing to
// show a user than nothing at all. Nothing here is meant to be read — only
// recognised as a shape.
//
// Geometry comes from documentGuideRect, the same function the overlay and the
// post-shutter crop use, so the ghost cannot drift from the rectangle the user
// is aiming at.

/**
 * How long the ghost stays before fading out. Long enough to register while the
 * user is still lifting the document into frame; short enough that it is gone
 * before it can obscure the document itself.
 */
export const DOCUMENT_GHOST_MS = 5000;
const FADE_MS = 400;

// White rather than a theme token: this sits on a camera feed, not on a
// surface, and the feed is the only thing behind it.
const LINE = 'rgba(255,255,255,0.30)';
const FILL = 'rgba(255,255,255,0.12)';
const BAND = 'rgba(255,255,255,0.35)';

function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function paintGhost(
  ctx: CanvasRenderingContext2D,
  size: { width: number; height: number },
  aspect: number,
  showMrzBand: boolean,
) {
  const guide = documentGuideRect(size, aspect);
  if (guide.width <= 0 || guide.height <= 0) return;

  // Inset so the layout sits inside the document's edge, not on the guide.
  const pad = guide.width * 0.07;
  const page = {
    left: guide.x + pad,
    top: guide.y + pad,
    right: guide.x + guide.width - pad,
    bottom: guide.y + guide.height - pad,
  };
  const pageW = page.right - page.left;
  const pageH = page.bottom - page.top;

  // ── Portrait block ────────────────────────────────────────────────────────
  // A block, not a face. The proportion is what identifies it.
  const photoW = pageW * 0.24;
  const photoH = showMrzBand ? pageH * 0.46 : pageH * 0.58;
  rounded(ctx, page.left, page.top, photoW, photoH, 4);
  ctx.fillStyle = FILL;
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ── Detail bars ───────────────────────────────────────────────────────────
  // Alternating lengths so it reads as printed fields rather than a barcode.
  const barLeft = page.left + photoW + pageW * 0.06;
  const barMax = page.right - barLeft;
  const widths = [1.0, 0.62, 0.85, 0.5];
  const barH = Math.min(Math.max(photoH * 0.1, 3), 7);
  ctx.fillStyle = FILL;
  for (let i = 0; i < widths.length; i++) {
    const y = page.top + photoH * (0.08 + i * 0.26);
    if (y + barH > page.top + photoH) break;
    rounded(ctx, barLeft, y, barMax * widths[i], barH, barH / 2);
    ctx.fill();
  }

  // ── MRZ band ──────────────────────────────────────────────────────────────
  // The reason the ghost exists: it shows the band belongs INSIDE the frame,
  // which is the edge users most often crop away.
  if (showMrzBand) {
    const bandH = Math.min(Math.max(pageH * 0.055, 3), 8);
    const top = page.bottom - bandH * 3.2;
    ctx.fillStyle = BAND;
    for (let i = 0; i < 2; i++) {
      rounded(
        ctx,
        page.left,
        top + i * bandH * 1.9,
        pageW * (i === 0 ? 1.0 : 0.93),
        bandH,
        bandH / 2,
      );
      ctx.fill();
    }
  }
}

export function DocumentGhost({
  /** Guide aspect (width / height) — a card and a passport page differ. */
  aspect,
  /** Draw the machine-readable band (passport data pages carry one). */
  showMrzBand = false,
  /**
   * Hides the ghost early. Once a document is framed the guidance has done its
   * job and would only sit on top of the thing being captured.
   */
  documentFound = false,
  /**
   * Mirror to match a mirrored preview (front-facing camera).
   *
   * The ghost is asymmetric — portrait on the left, detail bars on the right —
   * so on a flipped feed it points at the opposite side to the one the user
   * sees, which is worse guidance than none. The scan guide above it is
   * symmetric and needs no such treatment.
   */
  mirrored = false,
}: {
  aspect: number;
  showMrzBand?: boolean;
  documentFound?: boolean;
  mirrored?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [expired, setExpired] = useState(false);
  const visible = !expired && !documentFound;

  useEffect(() => {
    const timer = setTimeout(() => setExpired(true), DOCUMENT_GHOST_MS);
    return () => clearTimeout(timer);
  }, []);

  // Repaint on resize as well as on the inputs: the guide is derived from the
  // viewport, so a rotation would otherwise leave the ghost on the old rect.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible) return;

    const draw = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const { clientWidth: w, clientHeight: h } = parent;
      if (w <= 0 || h <= 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      paintGhost(ctx, { width: w, height: h }, aspect, showMrzBand);
    };

    draw();
    const observer =
      typeof ResizeObserver === 'function' ? new ResizeObserver(draw) : null;
    if (observer && canvas.parentElement) observer.observe(canvas.parentElement);
    return () => observer?.disconnect();
  }, [aspect, showMrzBand, visible]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 transition-opacity"
      style={{
        opacity: visible ? 1 : 0,
        transitionDuration: `${FADE_MS}ms`,
        // The same CSS flip the <video> gets, so the two cannot disagree by a
        // rounding error or a different transform origin.
        transform: mirrored ? 'scaleX(-1)' : undefined,
      }}
    />
  );
}
