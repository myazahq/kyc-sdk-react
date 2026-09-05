'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { StickyActions } from '../../components/StickyActions';
import {
  buildStreetViewFrameSrc,
  frameOriginOf,
  parseStreetViewFrameMessage,
  MAP_FRAME_READY_TIMEOUT_MS,
} from '../../lib/map-frame';
import { frameFov, type StreetViewFrame } from './StreetViewFramer';
import type { LatLng } from '../../lib/map-tiles';

// Street View for EMBEDDED mounts, via OUR hosted /embed/street-view page in
// an iframe — the same model (and the same grant) as FramedMapPicker. The
// page renders the panorama and streams the current view; THIS component owns
// the framing chrome, the frame-subtended fov maths and the capture decision,
// so hosted and embedded applicants meet the identical instrument. The
// overlay sits on top of the iframe with pointer-events-none, so panning
// passes straight through to the panorama. A page that never says sv-ready
// (blocked script, refused grant, no coverage) hands the step to the photo
// fallback via onUnavailable.

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function FramedStreetView({
  frameUrl,
  pin,
  theme,
  onCaptured,
  onSkip,
  hideSkip,
  onUnavailable,
}: {
  frameUrl: string;
  pin: LatLng;
  theme?: 'light' | 'dark';
  onCaptured: (frame: StreetViewFrame) => void;
  /** The applicant would rather add their own photo. */
  onSkip: () => void;
  /** streetView 'required': the skip affordance is removed while coverage
   *  exists (no-coverage still falls back — the client-UX gate only). */
  hideSkip?: boolean;
  /** No coverage, no grant, or no page — fall back to the photo. */
  onUnavailable: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const latestPov = useRef<{ panoId: string; heading: number; pitch: number; viewFov: number } | null>(null);
  const readyRef = useRef(false);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const unavailableRef = useRef(onUnavailable);
  unavailableRef.current = onUnavailable;

  const frameOrigin = useMemo(() => frameOriginOf(frameUrl), [frameUrl]);
  const src = useMemo(
    () => buildStreetViewFrameSrc(frameUrl, { parentOrigin: window.location.origin, pin, theme }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frameUrl],
  );

  useEffect(() => {
    if (!frameOrigin) {
      unavailableRef.current();
      return;
    }
    const timeout = window.setTimeout(() => {
      if (!readyRef.current) unavailableRef.current();
    }, MAP_FRAME_READY_TIMEOUT_MS);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== frameOrigin || event.source !== iframeRef.current?.contentWindow) return;
      const msg = parseStreetViewFrameMessage(event.data);
      if (!msg) return;
      if (msg.type === 'sv-ready') {
        readyRef.current = true;
        setStatus('ready');
      } else if (msg.type === 'sv-unavailable') {
        unavailableRef.current();
      } else {
        latestPov.current = { panoId: msg.panoId, heading: msg.heading, pitch: msg.pitch, viewFov: msg.viewFov };
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
    };
  }, [frameOrigin]);

  const capture = () => {
    const pov = latestPov.current;
    if (!pov) return;
    // The promise on screen is the FRAME, so the captured fov is the slice the
    // frame subtends of the reported viewport fov — same maths, same frame
    // geometry as the hosted framer.
    const frameWidth = frame.current?.getBoundingClientRect().width ?? 0;
    const viewWidth = viewport.current?.getBoundingClientRect().width ?? 0;
    const fov =
      frameWidth > 0 && viewWidth > 0
        ? clamp(frameFov(pov.viewFov, frameWidth / viewWidth), 10, 120)
        : clamp(pov.viewFov, 10, 120);
    onCaptured({ panoId: pov.panoId, heading: pov.heading, pitch: clamp(pov.pitch, -90, 90), fov });
  };

  return (
    <div className="space-y-3">
      <div
        ref={viewport}
        className="relative h-[40vh] min-h-[240px] max-h-[360px] w-full overflow-hidden rounded-xl border border-border bg-muted sm:h-[420px] sm:max-h-none"
      >
        <iframe
          ref={iframeRef}
          src={src}
          title="Street imagery. Drag to look around."
          className="absolute inset-0 h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin"
        />
        {status === 'loading' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {status === 'ready' && (
          // Identical chrome to the hosted framer (see its comment for the
          // geometry decisions); pointer-events-none, so the drag reaches the
          // iframe underneath.
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
        )}
      </div>
      {status === 'ready' && (
        <p className="text-center text-xs text-muted-foreground">
          Drag to look around until your gate or front door sits inside the frame.
        </p>
      )}
      <StickyActions>
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
      </StickyActions>
    </div>
  );
}
