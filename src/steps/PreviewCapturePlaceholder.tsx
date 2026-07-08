'use client';

import React from 'react';
import { Camera, ScanFace, Video } from 'lucide-react';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/ui/button';
import { useKYCContext } from '../context/KYCContext';
import { useKYCConfig } from '../context/KYCConfigContext';
import { stepAfterCapture } from '../lib/post-capture';

/**
 * Builder-preview stand-in for the camera steps (document capture & liveness).
 * The real steps request camera permission, load MediaPipe, and record video —
 * pointless (and intrusive) inside the dashboard's preview iframe, so preview
 * mode renders this static placeholder instead. Continue/back keep the flow
 * walkable end to end.
 */
export function PreviewCapturePlaceholder({ kind }: { kind: 'document' | 'liveness' }) {
  const { state, dispatch } = useKYCContext();
  const config = useKYCConfig();

  const hasLiveness =
    config.enableSelfie !== false &&
    (state.selectedIdType
      ? config.getIdTypeFeatures(config.country, state.selectedIdType)?.livenessCheck ?? config.enableLiveness !== false
      : config.enableLiveness !== false);
  const handleContinue = () => {
    if (kind === 'document' && hasLiveness) {
      dispatch({ type: 'SET_STEP', payload: 'liveness' });
      return;
    }
    const next = stepAfterCapture(config);
    if (next === 'submitted') {
      dispatch({ type: 'SUBMIT_VERIFICATION' });
    } else {
      dispatch({ type: 'SET_STEP', payload: next });
    }
  };

  const handleBack = () => {
    if (kind === 'document') {
      dispatch({ type: 'SET_STEP', payload: 'id-type' });
    } else {
      const def = state.selectedIdType ? config.getIdTypeDefinition(state.selectedIdType) : null;
      const cameFromDocument = def ? def.requiresDocumentCapture : true;
      dispatch({ type: 'SET_STEP', payload: cameFromDocument ? 'document-capture' : 'id-input' });
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <StepHeader
        title={kind === 'document' ? 'Scan your document' : 'Confirm you’re present'}
        description={
          kind === 'document'
            ? 'Real users capture the front (and back) of their ID here.'
            : 'Real users complete gesture challenges and a selfie here.'
        }
        onBack={handleBack}
      />

      {kind === 'document' ? (
        // Document frame — ID-card aspect ratio.
        <div className="mx-auto flex aspect-[1.586] w-full max-w-sm flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/40">
          <Camera className="h-8 w-8 text-muted-foreground/60" />
          <p className="px-6 text-center text-xs text-muted-foreground">
            Camera preview — Document Intelligence captures and reads the ID here
          </p>
        </div>
      ) : (
        // Face oval — mirrors the liveness viewfinder.
        <div className="mx-auto flex h-64 w-64 flex-col items-center justify-center gap-3 rounded-full border-2 border-dashed border-border bg-muted/40 sm:h-72 sm:w-72">
          <ScanFace className="h-9 w-9 text-muted-foreground/60" />
          <p className="max-w-[12rem] text-center text-xs text-muted-foreground">
            Camera preview — Presence Intelligence gesture challenges run here
          </p>
        </div>
      )}

      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Video className="h-3.5 w-3.5" />
        The camera only activates for real users — this is a builder preview.
      </div>

      <Button onClick={handleContinue} className="w-full h-12 rounded-xl text-base font-medium">
        Continue
      </Button>
    </div>
  );
}
