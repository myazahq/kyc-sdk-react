'use client';

import React from 'react';

// The Myaza map pin — one design for every web map surface (OSM picker,
// Google picker, and the hosted /embed/map page mirrors it). The ride-hailing
// LOLLIPOP (user decision 2026-08-28 — "an actual pin like Bolt uses"): a
// solid brand disc with a white eye on a thin stem whose tip touches the
// exact point, plus a GROUND SHADOW the pin lifts away from while the map
// pans — the settle on release is what tells the hand "this is where it will
// land". White casings on both disc and stem keep it legible on any tile.
//
// Rendered at the exact map centre: the parent positions this at 50%/50% and
// the tip touches that point. Pure presentation; `lifted` is the only input.

export function MapPinMarker({ lifted = false }: { lifted?: boolean }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-10" aria-hidden="true">
      {/* The ground shadow stays ON the spot; the pin lifts away from it. */}
      <span
        className={`absolute block rounded-full bg-gray-900/40 blur-[2px] transition-all duration-200 ease-out ${
          lifted ? 'h-[6px] w-5 opacity-45' : 'h-[4px] w-3 opacity-70'
        }`}
        style={{ transform: 'translate(-50%, -50%)' }}
      />
      <svg
        width="32"
        height="46"
        viewBox="0 0 32 46"
        className="absolute transition-transform duration-200 ease-out"
        style={{
          transform: `translate(-50%, ${lifted ? 'calc(-100% - 10px)' : '-100%'})`,
          filter: 'drop-shadow(0 3px 5px rgba(7, 3, 48, 0.35))',
        }}
      >
        {/* The whole pin wears the workflow's PRIMARY colour — the SDK themes
            the --primary custom property from appearance.primaryColor
            (lib/theme.ts), so every mount follows its flow automatically. The
            stem is the same colour darkened by a black overlay; white casings
            keep it legible on any tile, light OSM or dark Google. */}
        <rect x="13.4" y="22" width="5.2" height="23" rx="2.6" fill="#FFFFFF" />
        <rect x="14.6" y="23" width="2.8" height="21" rx="1.4" fill="var(--primary, #5645F5)" />
        <rect x="14.6" y="23" width="2.8" height="21" rx="1.4" fill="#000000" opacity="0.45" />
        <circle cx="16" cy="13" r="12" fill="var(--primary, #5645F5)" stroke="#FFFFFF" strokeWidth="2.5" />
        <circle cx="16" cy="13" r="4.25" fill="#FFFFFF" />
      </svg>
    </div>
  );
}
