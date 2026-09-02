'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPinPicker } from './MapPinPicker';
import type { LatLng } from '../lib/map-tiles';
import {
  buildMapFrameSrc,
  frameOriginOf,
  parseMapFrameMessage,
  centerMessage,
  MAP_FRAME_READY_TIMEOUT_MS,
} from '../lib/map-frame';
import { cn } from '../lib/utils';

// Google Maps for EMBEDDED mounts, via OUR hosted /embed/map page in an iframe
// (the OkHi model — the map runs on the hosted origin, so Myaza's
// referrer-restricted key works while the SDK sits on the org's domain). The
// page and this component speak the tiny protocol in lib/map-frame.ts; a page
// that never says `ready` (blocked script, refused grant, vendor outage) falls
// back to the dependency-free OSM picker, so the step can never go blank.

interface FramedMapPickerProps {
  frameUrl: string;
  value: LatLng | null;
  onChange: (pin: LatLng) => void;
  defaultCenter: LatLng;
  defaultZoom: number;
  theme?: 'light' | 'dark';
  primaryColor?: string;
  className?: string;
}

export function FramedMapPicker({
  frameUrl,
  value,
  onChange,
  defaultCenter,
  defaultZoom,
  theme,
  primaryColor,
  className,
}: FramedMapPickerProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastFromFrame = useRef<LatLng | null>(null);
  const readyRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const frameOrigin = useMemo(() => frameOriginOf(frameUrl), [frameUrl]);

  // Built once per mount: render-time params only change when the flow
  // restarts, and a src that tracked the pin would reload the page per drag.
  const src = useMemo(
    () =>
      buildMapFrameSrc(frameUrl, {
        parentOrigin: window.location.origin,
        center: value ?? defaultCenter,
        zoom: defaultZoom,
        hasPin: value != null,
        theme,
        primaryColor,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [frameUrl],
  );

  useEffect(() => {
    if (!frameOrigin) {
      setFailed(true);
      return;
    }
    const timeout = window.setTimeout(() => setFailed((f) => f || !readyRef.current), MAP_FRAME_READY_TIMEOUT_MS);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== frameOrigin || event.source !== frameRef.current?.contentWindow) return;
      const msg = parseMapFrameMessage(event.data);
      if (!msg) return;
      if (msg.type === 'ready') {
        readyRef.current = true;
        setReady(true);
      } else if (msg.type === 'failed') {
        setFailed(true);
      } else {
        lastFromFrame.current = { lat: msg.lat, lng: msg.lng };
        onChangeRef.current({ lat: msg.lat, lng: msg.lng });
      }
    };
    window.addEventListener('message', onMessage);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameOrigin]);

  // An external recentre (Use my location, restored progress) moves the map —
  // but never echo back a pin the frame itself just reported.
  useEffect(() => {
    if (!value || !ready || !frameOrigin) return;
    const last = lastFromFrame.current;
    if (last && Math.abs(last.lat - value.lat) < 1e-7 && Math.abs(last.lng - value.lng) < 1e-7) return;
    frameRef.current?.contentWindow?.postMessage(centerMessage(value), frameOrigin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng, ready]);

  if (failed) {
    return (
      <MapPinPicker
        value={value}
        onChange={onChange}
        defaultCenter={defaultCenter}
        defaultZoom={defaultZoom}
        className={className}
      />
    );
  }

  return (
    <div className={cn('relative h-64 w-full overflow-hidden rounded-xl border border-border bg-muted/40', className)}>
      <iframe
        ref={frameRef}
        src={src}
        title="Map. Drag to position the pin on your address."
        className="absolute inset-0 h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin"
      />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          Loading map…
        </div>
      )}
    </div>
  );
}
