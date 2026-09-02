'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MapPinPicker } from './MapPinPicker';
import { MapPinMarker } from './MapPinMarker';
import type { LatLng } from '../lib/map-tiles';
import { cn } from '../lib/utils';
import { loadGoogleMaps, type GoogleMapInstance } from '../lib/google-loader';

// Google Maps rendering for the address picker — HOSTED pages only (the OkHi
// model). The hosted-session bootstrap carries Myaza's browser key, which is
// referrer-restricted to the hosted origin; /config never returns one, so an
// embedded mount on an org's domain can never render this. A load failure, an
// invalid key, or builder preview all fall back to the dependency-free OSM
// picker, so the step can never go blank over a maps vendor. Same
// fixed-centre-pin interaction: the map moves under the pin.


interface GoogleMapPickerProps {
  /**
   * False = a read-only SUMMARY map (the review step): no zoom UI, no
   * gestures, and a clean styled roadmap with POI/transit pins hidden —
   * Google's styled maps do not apply to satellite, and the default POI
   * clutter (restaurants, pharmacies, bus stops) buries the one pin that
   * matters on a confirmation screen.
   */
  interactive?: boolean;
  apiKey: string;
  value: LatLng | null;
  onChange: (pin: LatLng) => void;
  defaultCenter: LatLng;
  defaultZoom: number;
  className?: string;
}

export function GoogleMapPicker({
  apiKey,
  value,
  onChange,
  defaultCenter,
  defaultZoom,
  className,
  interactive = true,
}: GoogleMapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const lastEmitted = useRef<LatLng | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [lifted, setLifted] = useState(false);

  useEffect(() => {
    let alive = true;
    loadGoogleMaps(apiKey)
      .then((api) => {
        if (!alive || !containerRef.current || mapRef.current) return;
        const start = value ?? defaultCenter;
        const map = new api.Map(containerRef.current, {
          center: { lat: start.lat, lng: start.lng },
          zoom: value ? 17 : defaultZoom,
          disableDefaultUI: true,
          zoomControl: interactive,
          // Satellite with labels: "find your roof" is answerable in a
          // Calabar compound where "find your street on a road map" is not —
          // the confirmation OkHi runs on satellite imagery for the same
          // reason. OSM fallback stays road view (it has no satellite).
          mapTypeId: interactive ? 'hybrid' : 'roadmap',
          clickableIcons: false,
          gestureHandling: interactive ? 'greedy' : 'none',
          keyboardShortcuts: false,
          ...(interactive
            ? {}
            : {
                styles: [
                  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
                ],
              }),
        });
        map.addListener('dragstart', () => setLifted(true));
        map.addListener('idle', () => {
          setLifted(false);
          const c = map.getCenter();
          if (!c) return;
          const next = { lat: c.lat(), lng: c.lng() };
          const last = lastEmitted.current;
          if (last && Math.abs(last.lat - next.lat) < 1e-7 && Math.abs(last.lng - next.lng) < 1e-7) return;
          lastEmitted.current = next;
          onChangeRef.current(next);
        });
        mapRef.current = map;
        setReady(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // An external recentre (Use my location) moves the map.
  useEffect(() => {
    if (!value || !mapRef.current) return;
    const last = lastEmitted.current;
    if (last && Math.abs(last.lat - value.lat) < 1e-7 && Math.abs(last.lng - value.lng) < 1e-7) return;
    lastEmitted.current = value;
    mapRef.current.setCenter({ lat: value.lat, lng: value.lng });
    // 18 on satellite shows individual roofs — the zoom at which "is the pin
    // on YOUR building?" is actually answerable without pinching first.
    mapRef.current.setZoom(18);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

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
      <div ref={containerRef} className="absolute inset-0" aria-label="Map. Drag to position the pin on your address." />
      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          Loading map…
        </div>
      )}
      {/* The fixed centre pin — lifted off its ground shadow while panning. */}
      <MapPinMarker lifted={lifted} />
    </div>
  );
}
