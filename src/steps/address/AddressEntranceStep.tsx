'use client';

import React, { useEffect, useState } from 'react';
import { StepHeader } from '../../components/StepHeader';
import { Button } from '../../components/ui/button';
import { AddressPhotoUpload } from '../../components/AddressPhotoUpload';
import { useKYCContext } from '../../context/KYCContext';
import { useAddressFlow } from './use-address-flow';
import { StreetViewFramer } from './StreetViewFramer';

/**
 * The entrance step: Street View FIRST — it opens automatically wherever
 * Google has photographed the street, because framing beats fumbling for a
 * camera — and the applicant's own photo is the fallback (no coverage, or
 * they skip). Capturing a frame advances straight to review.
 */
export function AddressEntranceStep() {
  const { state, dispatch } = useKYCContext();
  const flow = useAddressFlow();
  const streetView = flow.streetViewOffered && Boolean(flow.googleKey) && Boolean(flow.pin);
  const [mode, setMode] = useState<'framing' | 'photo'>(() => (streetView ? 'framing' : 'photo'));
  const [skipped, setSkipped] = useState(false);
  const photoUploaded = Boolean(state.mediaIds.addressPhoto);

  // Nothing to capture here (no coverage AND the photo input is off): move on
  // rather than showing an empty screen.
  const emptyFallback = mode === 'photo' && flow.photoMode === 'off';
  useEffect(() => {
    if (emptyFallback) flow.goNext('address-entrance');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emptyFallback]);
  if (emptyFallback) return null;

  const canContinue = !flow.uploading && (flow.photoMode !== 'required' || photoUploaded);

  return (
    <div className="space-y-4 animate-slide-up">
      <StepHeader
        title="Show the entrance"
        description={
          mode === 'framing'
            ? 'Frame your entrance in the street imagery. No camera needed.'
            : 'A picture of the gate or front door makes the address findable.'
        }
        onBack={() => flow.goBack('address-entrance')}
      />

      {mode === 'framing' && flow.googleKey && flow.pin ? (
        <StreetViewFramer
          apiKey={flow.googleKey}
          pin={flow.pin}
          onCaptured={(frame) => {
            if (state.address) {
              dispatch({ type: 'SET_ADDRESS', payload: { ...state.address, streetView: frame } });
            }
            flow.goNext('address-entrance');
          }}
          onSkip={() => {
            setSkipped(true);
            setMode('photo');
          }}
          onUnavailable={() => setMode('photo')}
        />
      ) : (
        <>
          {skipped && (
            <p className="text-sm text-muted-foreground">
              No problem. A quick photo of the entrance works just as well.
            </p>
          )}
          <AddressPhotoUpload
            required={flow.photoMode === 'required'}
            uploaded={photoUploaded}
            uploading={flow.uploading}
            onPick={(file) => void flow.pickPhoto(file)}
            onRemove={flow.removePhoto}
          />

          {flow.error && <p className="text-sm text-destructive">{flow.error}</p>}

          <Button
            onClick={() => flow.goNext('address-entrance')}
            disabled={!canContinue}
            className="h-12 w-full rounded-xl text-base font-medium"
          >
            {photoUploaded ? 'Continue' : flow.photoMode === 'required' ? 'Continue' : 'Continue without a photo'}
          </Button>
        </>
      )}
    </div>
  );
}
