'use client';

import React, { useEffect } from 'react';
import { Camera, MapPin } from 'lucide-react';
import { AddressMap } from '../../components/AddressMap';
import { StepHeader } from '../../components/StepHeader';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/utils';
import { useKYCContext } from '../../context/KYCContext';
import { useAddressFlow } from './use-address-flow';
import { displayAddressLine } from './flow-steps';

/**
 * The commit point, as ONE composed card: a clean summary map (no POI clutter,
 * no controls) with the entrance imagery hanging over its bottom edge like a
 * photo clipped to a document, and the address underneath as the card's own
 * heading. Tapping the map jumps back to the pin step; every row has its edit
 * link. The presence story lives on the intro screen, not here.
 */
export function AddressReviewStep() {
  const { state, dispatch } = useKYCContext();
  const flow = useAddressFlow();
  const { pin } = flow;

  // A refresh can land straight here with a restored pin that predates the
  // label fields — reverse-geocode it once rather than showing coordinates.
  useEffect(() => {
    if (state.address && !state.address.label) flow.relabelPin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const directions = state.address?.directions.trim() || null;
  const photoPreview = state.addressPhotoPreview;
  const photoUploaded = Boolean(state.mediaIds.addressPhoto);
  const frame = state.address?.streetView ?? null;

  // The framed entrance AS AN IMAGE: the browser key renders the exact framed
  // Street View client-side (the server stores its own copy at processing).
  const frameThumb =
    frame && flow.googleKey
      ? `https://maps.googleapis.com/maps/api/streetview?size=240x240&pano=${encodeURIComponent(frame.panoId)}&heading=${frame.heading}&pitch=${frame.pitch}&fov=${frame.fov}&key=${encodeURIComponent(flow.googleKey)}`
      : null;
  const hero = photoPreview
    ? { src: photoPreview, alt: 'Entrance photo' }
    : frameThumb
      ? { src: frameThumb, alt: 'Street View entrance' }
      : null;
  const second = photoPreview && frameThumb ? { src: frameThumb, alt: 'Street View entrance' } : null;

  const edit = (step: 'address-collection' | 'address-entrance') =>
    dispatch({ type: 'SET_STEP', payload: step });

  return (
    <div className="space-y-4 animate-slide-up">
      <StepHeader
        title={flow.isBusiness ? 'Confirm the premises' : 'Confirm your address'}
        description="Check everything is right before you continue."
        onBack={() => flow.goBack('address-review')}
      />

      <div className="overflow-hidden rounded-2xl border border-border/60">
        {pin && (
          <div className="relative">
            <AddressMap
              value={pin}
              onChange={() => undefined}
              defaultCenter={pin}
              defaultZoom={16}
              className="h-48 rounded-none border-0 sm:h-56"
              interactive={false}
            />
            <button
              type="button"
              aria-label="Edit the pinned location"
              onClick={() => edit('address-collection')}
              className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            />
            {/* The entrance hangs over the map's bottom edge — clipped to the
                address like a photo to a document, and BIG enough to read. */}
            {hero && (
              <img
                src={hero.src}
                alt={hero.alt}
                className="absolute -bottom-10 right-4 z-20 h-28 w-28 rounded-2xl border-4 border-background object-cover shadow-xl"
              />
            )}
            {second && (
              <img
                src={second.src}
                alt={second.alt}
                className="absolute -bottom-10 right-36 z-20 h-20 w-20 rounded-xl border-4 border-background object-cover shadow-lg"
              />
            )}
          </div>
        )}

        {/* The success card's header-band language, so the confirmation and
            the "check active" card read as one design. */}
        <div className="bg-primary/[0.06] px-4 pb-4 pt-4">
          <div className={cn('flex items-start justify-between gap-3', hero && 'min-h-[4.25rem] pr-32')}>
            <div className="min-w-0 space-y-1">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                <MapPin className="h-3 w-3" />
                {flow.isBusiness ? 'Pinned premises' : 'Pinned address'}
              </span>
              {/* One shared line with the pin summary + the server's composed
                  address (displayAddressLine) — typed number replaces a
                  differing picked one, a typed street leads the line. */}
              <p className="text-base font-semibold leading-snug">
                {state.address ? displayAddressLine(state.address) : 'No pin placed'}
              </p>
              {directions && (
                <p className="text-xs leading-snug text-muted-foreground">“{directions}”</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => edit('address-collection')}
              className="shrink-0 text-sm text-primary underline-offset-4 hover:underline"
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      {flow.error && <p className="text-sm text-destructive">{flow.error}</p>}

      <Button
        onClick={() => void flow.confirm()}
        disabled={!pin || flow.confirming}
        className="h-12 w-full rounded-xl text-base font-medium"
      >
        {flow.confirming ? 'Confirming…' : 'Confirm address'}
      </Button>

      {flow.address?.requirePin !== true && (
        <button
          type="button"
          onClick={flow.exitForward}
          className="w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          Skip for now
        </button>
      )}
    </div>
  );
}
