'use client';

import { DocumentScanOverlay } from './DocumentScanOverlay';
import { DocumentGhost } from './DocumentGhost';
import { DocumentPill, HintPill, SideBadge, Shutter } from './parts';
import type { DocumentFraming } from '../../lib/document-framing-gate';

// The desktop / inline viewfinder — the same language as the full-screen one,
// arranged for a 16:10 box inside the modal rather than a whole phone screen.
//
// It draws from the same DocumentScanOverlay and the same documentGuideRect as
// immersive, which is the point: before this, desktop had its own hand-rolled
// SVG guide on different geometry, so the two layouts looked like different
// products AND the post-shutter crop had to carry a second rectangle to match.
//
// What it deliberately does NOT carry, because the surrounding desktop chrome
// already does: the back control (the step header has one), the upload escape
// (the caption beneath the camera has one) and the torch (a laptop webcam has
// no flash, and the control is capability-gated anyway).

export function InlineOverlay({
  side,
  documentLabel,
  showMrzBand,
  country,
  guideAspect,
  framing,
  progress,
  hint,
  busy,
  mirrored,
  onCapture,
  primaryColor,
}: {
  side: 'front' | 'back';
  documentLabel: string;
  showMrzBand: boolean;
  country?: string | null;
  guideAspect: number;
  framing: DocumentFraming;
  progress: number;
  hint: string;
  busy: boolean;
  /** The preview is mirrored (front-facing camera). */
  mirrored: boolean;
  onCapture: () => void;
  primaryColor: string;
}) {
  return (
    <>
      <DocumentGhost
        aspect={guideAspect}
        showMrzBand={showMrzBand}
        documentFound={framing !== 'none' && framing !== 'wrongShape'}
        mirrored={mirrored}
      />

      <DocumentScanOverlay
        framing={framing}
        progress={progress}
        aspect={guideAspect}
        primaryColor={primaryColor}
      />

      <SideBadge side={side} primaryColor={primaryColor} style={{ top: '0.75rem', right: '0.75rem' }} />

      <DocumentPill
        label={documentLabel}
        country={country}
        style={{ top: '0.75rem' }}
      />

      {/* Hint sits directly above the shutter, close enough to read as one
          control group in a box far shorter than a phone screen. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-3 px-4">
        <HintPill>{hint}</HintPill>
        <Shutter
          onCapture={onCapture}
          busy={busy}
          primaryColor={primaryColor}
          size={56}
        />
      </div>
    </>
  );
}
