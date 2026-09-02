'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { MapPinMarker } from './MapPinMarker';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  panCenter,
  visibleTiles,
  type LatLng,
} from '../lib/map-tiles';
import { cn } from '../lib/utils';

interface MapPinPickerProps {
  /** The confirmed pin, when one exists — the map centres on it. */
  value: LatLng | null;
  /** Fired when the user settles the map (drag end / zoom / recentre). */
  onChange: (pin: LatLng) => void;
  defaultCenter: LatLng;
  defaultZoom: number;
  /** Builder preview: render a placeholder, load no tiles, take no input. */
  preview?: boolean;
  className?: string;
  /** False = read-only summary map: no drag, no zoom buttons. */
  interactive?: boolean;
}

/**
 * A dependency-free OSM slippy map with a FIXED CENTRE PIN — the user moves
 * the map under the pin (the pattern address pickers use on phones), so the
 * pin is always exactly the centre and there is no marker to fumble. Maths in
 * lib/map-tiles.ts; this is only the pointer-events shell.
 */
export function MapPinPicker({ value, onChange, defaultCenter, defaultZoom, preview, className, interactive = true }: MapPinPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [center, setCenter] = useState<LatLng>(value ?? defaultCenter);
  const [zoom, setZoom] = useState(value ? 16 : defaultZoom);
  // Live drag offset — applied as a transform so panning stays smooth; the
  // centre (and tile set) commits on release.
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // An external recentre (Use my location, a search pick) moves the map and
  // zooms to building scale. SELF-caused moves round-trip through the same
  // prop (a drag commits via onChange → state → new `value`), so external is
  // "differs from the centre the map is already showing" — without that
  // check, an applicant who zoomed out to find their area was yanked back to
  // pin zoom on every drag. Both mobile pickers carry the same guard.
  const centerRef = useRef(center);
  centerRef.current = center;
  useEffect(() => {
    if (!value) return;
    const c = centerRef.current;
    if (Math.abs(c.lat - value.lat) < 1e-9 && Math.abs(c.lng - value.lng) < 1e-9) return;
    setCenter(value);
    setZoom((z) => Math.max(z, 17));
  }, [value?.lat, value?.lng]);

  const commit = useCallback(
    (next: LatLng, nextZoom = zoom) => {
      setCenter(next);
      setZoom(nextZoom);
      onChange(next);
    },
    [onChange, zoom],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (preview) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY };
    setDrag({ dx: 0, dy: 0 });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    setDrag({ dx: e.clientX - dragStart.current.x, dy: e.clientY - dragStart.current.y });
  };
  const onPointerUp = () => {
    if (!dragStart.current || !drag) return;
    dragStart.current = null;
    setDrag(null);
    if (drag.dx !== 0 || drag.dy !== 0) commit(panCenter(center, zoom, drag.dx, drag.dy));
  };

  const zoomBy = (delta: number) => {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
    if (next !== zoom) commit(center, next);
  };

  const tiles = !preview && size ? visibleTiles(center, zoom, size.w, size.h) : [];

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative h-64 w-full touch-none select-none overflow-hidden rounded-xl border border-border bg-muted/40',
        preview ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
        className,
      )}
      onPointerDown={interactive ? onPointerDown : undefined}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="application"
      aria-label="Map. Drag to position the pin on your address."
    >
      {preview ? (
        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
          Map preview
        </div>
      ) : (
        <div
          className="absolute inset-0"
          style={drag ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : undefined}
        >
          {tiles.map((tile) => (
            <img
              key={tile.key}
              src={tile.url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute h-64 w-64 max-w-none"
              style={{ left: tile.left, top: tile.top, height: 256, width: 256 }}
              loading="lazy"
            />
          ))}
        </div>
      )}

      {/* The fixed centre pin — lifted off its ground shadow while panning. */}
      <MapPinMarker lifted={drag !== null} />

      {!preview && interactive && (
        <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-lg border border-border bg-background shadow-sm">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => zoomBy(1)}
            className="p-2 transition-colors hover:bg-muted"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => zoomBy(-1)}
            className="border-t border-border p-2 transition-colors hover:bg-muted"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* OSM tile-usage terms require visible attribution. */}
      <div className="pointer-events-none absolute bottom-1 right-2 rounded bg-background/70 px-1 text-[10px] text-muted-foreground">
        © OpenStreetMap contributors
      </div>
    </div>
  );
}
