'use client';

import React from 'react';
import { Camera, SwitchCamera, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

export type ViewfinderMode = 'selfie' | 'document';

interface CameraViewfinderProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  mode: ViewfinderMode;
  isReady: boolean;
  error: string | null;
  onCapture: () => void;
  onSwitchCamera?: () => void;
  onRetry?: () => void;
  className?: string;
}

export function CameraViewfinder({
  videoRef,
  mode,
  isReady,
  error,
  onCapture,
  onSwitchCamera,
  onRetry,
  className,
}: CameraViewfinderProps) {
  const isSelfie = mode === 'selfie';

  // Error / permission-denied fallback
  if (error) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-4 rounded-xl bg-gray-900 p-8 text-center text-white',
          className,
        )}
        style={{ aspectRatio: isSelfie ? '3/4' : '16/10' }}
      >
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="text-white border-white/30">
            Try Again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn('relative overflow-hidden rounded-xl bg-black', className)}
      style={{ aspectRatio: isSelfie ? '3/4' : '16/10' }}
    >
      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          'h-full w-full object-cover',
          isSelfie && 'transform-[scaleX(-1)]',
        )}
      />

      {/* Overlay */}
      {isSelfie ? <SelfieOverlay /> : <DocumentOverlay />}

      {/* Loading indicator */}
      {!isReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-6">
        {/* Switch camera button */}
        {onSwitchCamera && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onSwitchCamera}
            className="h-10 w-10 rounded-full bg-white/20 text-white hover:bg-white/30"
            aria-label="Switch camera"
          >
            <SwitchCamera className="h-5 w-5" />
          </Button>
        )}

        {/* Capture button */}
        <button
          onClick={onCapture}
          disabled={!isReady}
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-primary bg-white transition-transform active:scale-95 disabled:opacity-50"
          aria-label="Capture photo"
        >
          <Camera className="h-6 w-6 text-primary" />
        </button>

        {/* Spacer to balance the layout when switch button is present */}
        {onSwitchCamera && <div className="h-10 w-10" />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------

function SelfieOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Semi-transparent mask with oval cutout */}
      <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <mask id="selfie-mask">
            <rect width="100" height="100" fill="white" />
            <ellipse cx="50" cy="42" rx="28" ry="35" fill="black" />
          </mask>
        </defs>
        <rect
          width="100"
          height="100"
          fill="rgba(0,0,0,0.6)"
          mask="url(#selfie-mask)"
        />
      </svg>
      {/* Guide text */}
      <div className="absolute bottom-20 left-0 right-0 text-center">
        <p className="text-sm font-medium text-white/80">
          Position your face within the oval
        </p>
      </div>
    </div>
  );
}

function DocumentOverlay() {
  // ID card aspect ratio: 85.6mm x 53.98mm ≈ 1.586:1
  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="h-full w-full" viewBox="0 0 160 100" preserveAspectRatio="none">
        <defs>
          <mask id="doc-mask">
            <rect width="160" height="100" fill="white" />
            <rect x="15" y="12" width="130" height="76" rx="4" fill="black" />
          </mask>
        </defs>
        <rect
          width="160"
          height="100"
          fill="rgba(0,0,0,0.6)"
          mask="url(#doc-mask)"
        />
        {/* Corner accents */}
        <rect x="15" y="12" width="130" height="76" rx="4" fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="8,4" />
      </svg>
      {/* Guide text */}
      <div className="absolute bottom-20 left-0 right-0 text-center">
        <p className="text-sm font-medium text-white/80">
          Align your ID within the frame
        </p>
      </div>
    </div>
  );
}
