'use client';

import React from 'react';

// The Myaza map pin — one design for every web map surface (OSM picker,
// Google picker, and the hosted /embed/map page mirrors it). A 1:1 copy of
// the Bolt reference (user decision 2026-09-03, measured off their dragging
// frame): head 1.0 (46px), eye 0.31, stem 0.098 wide showing 0.41 below the
// head, no casings, no CSS drop-shadow — the body is flat.
//
// The GROUND DOT (0.18×0.08 of the head) is the drag-state shadow: while the
// map pans the pin lifts 17px and the dot appears at the landing point
// beneath it — the reference's floating-pin-over-dot frame — and when the
// pin lands the dot fades away (user decision), leaving the stem tip resting
// exactly on the picked coordinate.
//
// Rendered at the exact map centre: the parent positions this at 50%/50%,
// the settled stem tip touches that point, and the dot marks it mid-drag.

export function MapPinMarker({ lifted = false }: { lifted?: boolean }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-10" aria-hidden="true">
      {/* The landing dot — fixed to the map centre while the pin floats,
          gone once it lands. Slightly blurred so it reads as a cast shadow,
          not a painted dot (sized up a touch to survive the blur). */}
      <span
        className={`absolute h-[5px] w-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#070330]/50 blur-[1.5px] transition-opacity duration-200 ${lifted ? 'opacity-100' : 'opacity-0'}`}
      />
      <svg
        width="46"
        height="65"
        viewBox="0 0 46 65"
        className="absolute transition-transform duration-200 ease-out"
        style={{ transform: `translate(-50%, ${lifted ? 'calc(-100% - 17px)' : '-100%'})` }}
      >
        {/* The whole pin wears the workflow's PRIMARY colour — the SDK themes
            the --primary custom property from appearance.primaryColor
            (lib/theme.ts), so every mount follows its flow automatically. */}
        <rect x="20.75" y="42" width="4.5" height="23" rx="2.25" fill="var(--primary, #5645F5)" />
        <circle cx="23" cy="23" r="23" fill="var(--primary, #5645F5)" />
        <circle cx="23" cy="23" r="7" fill="#FFFFFF" />
      </svg>
    </div>
  );
}
