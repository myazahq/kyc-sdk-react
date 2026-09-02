'use client';

import React from 'react';
import { ChevronRight, Loader2, LocateFixed, MapPin } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * "Use my current location" as a proper row, not a button pretending to be
 * two: an icon medallion that shows the fix's state (searching / found), a
 * left-aligned title with the RESOLVED ADDRESS underneath — so the person can
 * see where it will take them before tapping — and a chevron that says "this
 * goes somewhere". Shared by the search and pin steps.
 */
export function CurrentLocationRow({
  hint,
  locating,
  onClick,
}: {
  /** The device's resolved current address, when known. */
  hint: string | null;
  locating: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors',
          hint ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
        )}
      >
        {locating && !hint ? (
          <Loader2 className="h-4.5 w-4.5 animate-spin" />
        ) : hint ? (
          <MapPin className="h-4.5 w-4.5" />
        ) : (
          <LocateFixed className="h-4.5 w-4.5" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Use my current location</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {hint ?? (locating ? 'Finding your location…' : 'Lands the pin right where you are')}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

/**
 * The DEMOTED form of the row above, for once a pin exists: locating again is
 * then a rare corrective action, not the primary one, so it becomes the
 * conventional locate pill ON the map (bottom-centre, where the eye and
 * thumb already are; the corners belong to the Google logo, attribution and
 * zoom controls) — off the Continue path and
 * deliberate to hit, where the full-width row invited a mistaken tap that
 * yanked a confirmed address to wherever the phone was.
 */
export function LocateFab({ locating, onClick }: { locating: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Move the pin to my current location"
      onClick={onClick}
      disabled={locating}
      className="absolute bottom-4 left-1/2 z-10 flex h-10 -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-background pl-3 pr-3.5 shadow-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {locating ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <LocateFixed className="h-4 w-4 shrink-0 text-primary" />
      )}
      <span className="text-xs font-semibold">
        {locating ? 'Finding you…' : 'Use my location'}
      </span>
    </button>
  );
}
