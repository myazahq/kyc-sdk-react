'use client';

import React from 'react';
import { Nfc } from 'lucide-react';

/**
 * The passport a user holds against their phone, drawn as the CLOSED booklet
 * cover — the portrait shape, and the title / emblem / chip-symbol stack every
 * e-passport shares.
 *
 * Rendered in the SDK's own theme tokens rather than navy-and-gold: it sits
 * inside the host app's palette and has to work in light and dark, so it reads
 * as an illustration of a passport, not a photograph of one. The only accent is
 * the ICAO chip mark, which is the part that matters here.
 */

/**
 * The international e-passport symbol (ICAO 9303), printed on the cover of every
 * chipped passport. It does more work here than a generic chip glyph: a
 * passport's chip is embedded with no visible contact pads, so this symbol is
 * what tells a holder the document can be read over NFC at all.
 */
function EPassportMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 16" fill="none" className={className} aria-hidden>
      <rect x="0.9" y="0.9" width="22.2" height="14.2" rx="2.2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7.6" cy="8" r="1.7" fill="currentColor" />
      <path d="M11.4 5.2a4.6 4.6 0 0 1 0 5.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14.7 3a8.4 8.4 0 0 1 0 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * A generic state emblem — a globe in a laurel wreath. Deliberately NOT any real
 * country's arms: the SDK verifies passports from every country, so this stands
 * in for all of them rather than showing a holder the wrong nation's crest.
 */
function StateEmblem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden>
      {/* Globe */}
      <circle cx="24" cy="21" r="8.6" stroke="currentColor" strokeWidth="1.3" />
      <ellipse cx="24" cy="21" rx="3.5" ry="8.6" stroke="currentColor" strokeWidth="1" />
      <path d="M15.6 18.4h16.8M15.6 23.6h16.8" stroke="currentColor" strokeWidth="1" />
      {/* Laurel wreath */}
      <path
        d="M17 34c-5-2.6-7.6-7-7.6-12.4 0-2.4.5-4.6 1.5-6.6M31 34c5-2.6 7.6-7 7.6-12.4 0-2.4-.5-4.6-1.5-6.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M12.4 19.6c1.8-.4 3.2 0 4.2 1.2M13.2 25.4c1.8-.2 3.2.4 4 1.7M35.6 19.6c-1.8-.4-3.2 0-4.2 1.2M34.8 25.4c-1.8-.2-3.2.4-4 1.7"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* Star finial */}
      <path d="m24 6 1.4 3.1 3.4.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.4-.5L24 6Z" fill="currentColor" />
    </svg>
  );
}

export function PassportIllustration() {
  return (
    <div className="relative mx-auto flex h-96 w-full items-center justify-center">
      {/* Closed booklet: 88×125mm → aspect 0.71. The squarer left edge is the
          spine side, which is what separates a booklet from a card. The printed
          elements scale with the cover, so it reads the same at any size — at
          h-96 the booklet is ~273px wide, which still clears the modal's
          horizontal padding on a 390pt phone. */}
      <div className="relative aspect-[0.71] h-full rounded-r-2xl rounded-l-lg border-2 border-border bg-muted/40 shadow-sm">
        <div className="flex h-full flex-col items-center justify-between px-6 py-9 text-center">
          {/* The document title sits here. Left as a placeholder bar, like the
              country lines below: covers are printed in the issuing state's own
              language, so any literal word would be wrong for most holders. */}
          <span className="block h-3.5 w-32 rounded-full bg-border" />

          <StateEmblem className="h-24 w-24 text-muted-foreground/60" />

          {/* Where the issuing country is printed — ghost lines for the same
              reason. */}
          <div className="flex flex-col items-center gap-2">
            <span className="block h-2 w-28 rounded-full bg-border" />
            <span className="block h-2 w-16 rounded-full bg-border" />
          </div>

          <EPassportMark className="h-6 w-9 text-amber-500/70" />
        </div>

        {/* Phone held against the cover, reading the chip underneath — the pulse
            sits inside it, where the antenna actually is. */}
        <div className="absolute -bottom-5 -right-11 h-32 w-[72px] rounded-2xl border-2 border-foreground/30 bg-background/95 shadow-md">
          <span className="mx-auto mt-2.5 block h-1 w-7 rounded-full bg-foreground/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <span className="absolute inset-2 animate-pulse rounded-full bg-primary/15" />
              <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                <Nfc className="h-5 w-5" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
