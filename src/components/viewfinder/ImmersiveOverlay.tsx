import { ArrowLeft, Upload, Zap, ZapOff } from 'lucide-react';
import { DocumentScanOverlay } from './DocumentScanOverlay';
import { DocumentGhost } from './DocumentGhost';
import { DocumentPill, HintPill, SCRIM, SideBadge, Shutter } from './parts';
import type { DocumentFraming } from '../../lib/document-framing-gate';
import { cn } from '../../lib/utils';

// Everything drawn over the full-screen camera, laid out to match the Flutter
// document-capture screen: back control top-left, FRONT/BACK badge top-right,
// the document pill (with its issuing country's flag) centred beneath it, the
// hint as a dark pill above the controls, then the upload escape, the shutter
// and the torch.
//
// The animated frame itself is DocumentScanOverlay — a canvas port of Flutter's
// scan painter. This file is only the chrome around it, kept separate for the
// same reason Flutter splits overlay from painter. The individual pieces live
// in ./parts and are shared with InlineOverlay.

export function ImmersiveOverlay({
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
  torch,
  hasTorch,
  onToggleTorch,
  onCapture,
  onBack,
  onUpload,
  primaryColor,
}: {
  side: 'front' | 'back';
  documentLabel: string;
  /** Passport data pages carry a machine-readable band; cards do not. */
  showMrzBand: boolean;
  country?: string | null;
  guideAspect: number;
  framing: DocumentFraming;
  progress: number;
  hint: string;
  busy: boolean;
  /** The preview is mirrored (front-facing camera). */
  mirrored: boolean;
  torch: boolean;
  hasTorch: boolean;
  onToggleTorch: () => void;
  onCapture: () => void;
  onBack: (() => void) | null;
  onUpload: (() => void) | null;
  primaryColor: string;
}) {
  const top = 'calc(env(safe-area-inset-top) + 0.75rem)';

  return (
    <>
      {/* Layout ghost — where the portrait, the details and (on a passport) the
          MRZ band belong. Shown for a few seconds when the camera opens, then
          out of the way. Sits UNDER the scan overlay, as in Flutter, so the
          guide's own scrim and corners stay the brightest thing on screen. */}
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

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="absolute z-20 flex h-11 w-11 items-center justify-center rounded-full text-white backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          style={{ top, left: '1rem', backgroundColor: SCRIM }}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}

      <SideBadge side={side} primaryColor={primaryColor} style={{ top, right: '1rem' }} />

      <DocumentPill
        label={documentLabel}
        country={country}
        style={{ top: `calc(${top} + 3.25rem)` }}
      />

      {/* Bottom stack: hint pill → upload escape → shutter + torch. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-5 px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <HintPill>{hint}</HintPill>

        {onUpload && (
          <button
            type="button"
            onClick={onUpload}
            className="pointer-events-auto inline-flex items-center gap-2 text-sm font-medium text-white/90 focus-visible:outline-none focus-visible:underline"
          >
            <Upload className="h-4 w-4" />
            Upload a photo instead
          </button>
        )}

        <div className="relative flex w-full items-center justify-center">
          <Shutter onCapture={onCapture} busy={busy} primaryColor={primaryColor} />

          {/* Torch sits bottom-right rather than beside the shutter, matching
              Flutter. Hidden entirely when the device cannot toggle it. */}
          {hasTorch && (
            <button
              type="button"
              onClick={onToggleTorch}
              aria-label={torch ? 'Turn torch off' : 'Turn torch on'}
              aria-pressed={torch}
              className={cn(
                'pointer-events-auto absolute right-0 flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                torch ? 'text-black' : 'text-white',
              )}
              style={{ backgroundColor: torch ? '#ffffff' : SCRIM }}
            >
              {torch ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
