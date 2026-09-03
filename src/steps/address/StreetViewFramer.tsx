'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { loadGoogleMaps, type PanoramaInstance } from '../../lib/google-loader';
import type { LatLng } from '../../lib/map-tiles';

// The OkHi entrance trick, provenance-honest: the applicant pans a Street
// View panorama until their entrance sits inside the frame, and we submit
// only the FRAME COORDINATES (pano id + heading/pitch/fov) — the server
// fetches the actual image with its own key. Needs the Google browser key in
// the document, so this renders on HOSTED pages (v1). Opens automatically
// when coverage exists; `onUnavailable` hands the step to the photo fallback.

export interface StreetViewFrame {
  panoId: string;
  heading: number;
  pitch: number;
  fov: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The field of view a centred sub-frame of the viewport actually subtends.
 * The frame is entrance-sized guidance, so the STORED image must be what the
 * frame showed, not the whole panorama — otherwise "fit your gate in the
 * frame" captures a streetscape with the gate somewhere in it. Exact
 * projection maths (a perspective view is a flat plane, so a width fraction
 * maps through tan, not linearly); pure and unit-tested.
 */
export function frameFov(viewportFovDeg: number, widthFraction: number): number {
  const fraction = clamp(widthFraction, 0.1, 1);
  const half = (viewportFovDeg * Math.PI) / 360;
  return (2 * Math.atan(fraction * Math.tan(half)) * 180) / Math.PI;
}

export function StreetViewFramer({
  apiKey,
  pin,
  onCaptured,
  onSkip,
  hideSkip,
  onUnavailable,
}: {
  apiKey: string;
  pin: LatLng;
  onCaptured: (frame: StreetViewFrame) => void;
  /** The applicant would rather add their own photo. */
  onSkip: () => void;
  /** streetView 'required': the skip affordance is removed while coverage
   *  exists (no-coverage still falls back — the client-UX gate only). */
  hideSkip?: boolean;
  /** Street View has not photographed this spot — fall back to the photo. */
  onUnavailable: () => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const pano = useRef<PanoramaInstance | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const unavailableRef = useRef(onUnavailable);
  unavailableRef.current = onUnavailable;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const api = await loadGoogleMaps(apiKey);
        const svc = new api.StreetViewService();
        const found = await svc.getPanorama({
          location: { lat: pin.lat, lng: pin.lng },
          radius: 75,
          preference: 'nearest',
          source: 'outdoor',
        });
        const panoId = found.data.location?.pano;
        if (cancelled) return;
        if (!panoId || !holder.current) {
          unavailableRef.current();
          return;
        }
        pano.current = new api.StreetViewPanorama(holder.current, {
          pano: panoId,
          pov: { heading: 0, pitch: 0 },
          zoom: 1,
          addressControl: false,
          fullscreenControl: false,
          motionTracking: false,
          showRoadLabels: false,
        });
        setStatus('ready');
      } catch {
        if (!cancelled) unavailableRef.current();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiKey, pin.lat, pin.lng]);

  const capture = () => {
    const p = pano.current;
    if (!p) return;
    const pov = p.getPov();
    // Google's zoom→fov relationship gives the VIEWPORT's field of view…
    const viewFov = clamp(180 / Math.pow(2, p.getZoom() || 1), 10, 120);
    // …but the promise on screen is the FRAME, so the captured fov is the
    // slice the frame subtends (measured, so the max-width clamps are
    // honoured). No frame to measure ⇒ fall back to the full view.
    const frameWidth = frame.current?.getBoundingClientRect().width ?? 0;
    const viewWidth = holder.current?.getBoundingClientRect().width ?? 0;
    const fov =
      frameWidth > 0 && viewWidth > 0
        ? clamp(frameFov(viewFov, frameWidth / viewWidth), 10, 120)
        : viewFov;
    const heading = ((pov.heading % 360) + 360) % 360;
    onCaptured({ panoId: p.getPano(), heading, pitch: clamp(pov.pitch, -90, 90), fov });
  };

  return (
    <div className="space-y-3">
      <div className="relative h-[52vh] min-h-[300px] w-full overflow-hidden rounded-xl border border-border bg-muted sm:h-[420px]">
        <div ref={holder} className="absolute inset-0" />
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {status === 'ready' && (
          <>
            {/* z-10+: the panorama stacks its own layers inside the holder,
                and without an explicit z-index the frame paints UNDER them.
                Entrance-sized on purpose: a frame that nearly fills the view
                makes "fit your entrance" mean "have it on screen", so nobody
                actually centres the gate. Small enough that framing is a
                deliberate act; the captured fov matches what it shows.

                Centred at 44%, not 50%: Google draws its street-navigation
                chevrons at the viewport's lower middle, and a mid-centred
                frame put its bottom edge straight through them. Raising the
                frame keeps both instruments legible; the ~3 degrees of pitch
                the offset implies is nothing against a gate. The pill is
                anchored to the frame's top edge so label and frame read as
                one instrument instead of two floating things. */}
            <div className="pointer-events-none absolute left-1/2 top-[44%] z-10 h-[56%] max-h-[300px] w-[58%] max-w-[320px] -translate-x-1/2 -translate-y-1/2">
              <div
                ref={frame}
                className="absolute inset-0 rounded-2xl border-2 border-white/95 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                aria-hidden
              />
              <span className="absolute -top-10 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/65 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                Fit your entrance in the frame
              </span>
            </div>
          </>
        )}
      </div>
      {status === 'ready' && (
        <p className="text-center text-xs text-muted-foreground">
          Drag to look around until your gate or front door sits inside the frame.
        </p>
      )}
      <div className="flex gap-2">
        {!hideSkip && (
          <Button variant="outline" onClick={onSkip} className="h-11 flex-1 rounded-xl">
            Skip
          </Button>
        )}
        <Button onClick={capture} disabled={status !== 'ready'} className="h-11 flex-1 rounded-xl">
          Use this view
        </Button>
      </div>
    </div>
  );
}
