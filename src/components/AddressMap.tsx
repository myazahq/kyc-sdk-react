'use client';

import React from 'react';
import { GoogleMapPicker } from './GoogleMapPicker';
import { FramedMapPicker } from './FramedMapPicker';
import { MapPinPicker } from './MapPinPicker';
import { useKYCConfig } from '../context/KYCConfigContext';
import type { LatLng } from '../lib/map-tiles';

// Which map the address step renders, in one place (split from
// AddressCollectionStep per the 200-line rule). Strongest surface first:
//
//  1. HOSTED pages hold Myaza's Google key directly (the session bootstrap
//     ships it — the page already runs on the hosted origin).
//  2. EMBEDDED mounts get Google via OUR framed /embed/map page when /config
//     minted a frame URL (see lib/map-frame.ts); the frame falls back to OSM
//     on any failure.
//  3. Everything else — no key configured, or a frame that fails — is the
//     dependency-free OSM picker. The builder preview renders the REAL map,
//     Google included (user decision 2026-08-27): an author previewing the
//     address step sees exactly what applicants get, and the frame's own
//     grant/fallback chain still guards the failure modes.

interface AddressMapProps {
  value: LatLng | null;
  onChange: (pin: LatLng) => void;
  defaultCenter: LatLng;
  defaultZoom: number;
  /** Height/size override — the pin step goes near full screen on mobile. */
  className?: string;
  /** False = read-only summary map (the review step): no zoom UI, no
   *  gestures, POI clutter hidden. */
  interactive?: boolean;
}

// Everything surface-specific (hosted key, frame URL, preview, theming) comes
// from the config context, so the step passes only the map's actual inputs.
export function AddressMap({ value, onChange, defaultCenter, defaultZoom, className, interactive = true }: AddressMapProps) {
  const config = useKYCConfig();
  const googleKey = config.serverConfig?.googleMapsBrowserKey;
  const frameUrl = config.serverConfig?.mapsFrameUrl;
  const preview = config.previewMode;
  const theme = config.appearance?.theme === 'dark' ? ('dark' as const) : ('light' as const);
  const primaryColor = config.appearance?.primaryColor;
  if (googleKey) {
    return (
      <GoogleMapPicker
        apiKey={googleKey}
        value={value}
        onChange={onChange}
        defaultCenter={defaultCenter}
        defaultZoom={defaultZoom}
        className={className}
        interactive={interactive}
      />
    );
  }
  if (frameUrl) {
    return (
      <FramedMapPicker
        frameUrl={frameUrl}
        value={value}
        onChange={onChange}
        defaultCenter={defaultCenter}
        defaultZoom={defaultZoom}
        theme={theme}
        primaryColor={primaryColor}
        className={className}
      />
    );
  }
  return (
    <MapPinPicker
      value={value}
      onChange={onChange}
      defaultCenter={defaultCenter}
      defaultZoom={defaultZoom}
      className={className}
      interactive={interactive}
    />
  );
}
