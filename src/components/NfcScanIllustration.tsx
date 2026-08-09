'use client';

import React from 'react';

/**
 * What the user is being asked to DO: hold the document flat against the back
 * of the phone until the chip is read.
 *
 * The phone is drawn from the FRONT. Mid-scan this is exactly what the user
 * sees — their own screen, with the passport pressed behind it and peeking out
 * past the edge — so the illustration is a first-person preview of the act
 * rather than a diagram of it. (An earlier version showed the phone's back "
 * because that is the side the ID touches"; technically true and experientially
 * wrong — nobody sees the back of their own phone while scanning.) It is also
 * the composition iOS's own "Ready to Scan" sheet trained everyone on: phone
 * upright, document behind, waves between.
 *
 * The two objects are drawn to LIFE scale — a passport is 88×125mm, a phone
 * ~71×147mm, near enough the same object in the hand. Getting that ratio wrong
 * is what made the old drawing invert the instruction into "put your phone on
 * this huge passport".
 *
 * The story is three beats and no more: a document with a CHIP, a phone held
 * over it, a FIELD between them. Everything that didn't serve one of those
 * beats has been cut — the contactless glyph that used to sit on the phone's
 * screen was a second, smaller copy of the field competing for the same
 * glance, and the ICAO mark on the document meant nothing to people who have
 * never consciously noticed it on their own passport. The chip is drawn as
 * the bank-card contact pad instead, the one chip everyone recognises.
 *
 * Exactly ONE element is `primary`: the field. Everything else is neutral
 * theme tokens, so the drawing inherits an org's palette and works in both
 * modes. Single SVG rather than positioned divs so the overlap, the tilts and
 * the fan stay geometrically exact at every width.
 */

/**
 * Where the field originates: on the phone's edge, at antenna height. The real
 * coupling happens BEHIND the phone's centre, but from the front that point is
 * invisible — the edge is where the signal can be seen passing between the two
 * objects, which is the visual language the iOS scan sheet uses too.
 */
const COUPLING = { x: 173, y: 88 } as const;

/** Arc radii, innermost first. Each is one "ripple" of the field. */
const WAVES = [
  { r: 16, opacity: 0.9, delay: '0ms' },
  { r: 28, opacity: 0.65, delay: '150ms' },
  { r: 40, opacity: 0.42, delay: '300ms' },
  { r: 50, opacity: 0.25, delay: '450ms' },
] as const;

/** Half-angle of the fan, in degrees — wide enough to read as a field. */
const SPREAD = 56;

/**
 * One ripple, opening toward the document.
 *
 * Computed rather than hand-authored so the fan stays concentric when a radius
 * is tuned; four hand-written `A` commands drift the moment one changes. The
 * outermost radius is sized to clear the emblem and title printing on the
 * cover behind — the field should wash OVER the document, not scribble on it.
 */
function wavePath(r: number): string {
  const rad = (SPREAD * Math.PI) / 180;
  const dx = Math.cos(rad) * r;
  const dy = Math.sin(rad) * r;
  const x = COUPLING.x + dx;
  return `M ${x.toFixed(1)} ${(COUPLING.y - dy).toFixed(1)} A ${r} ${r} 0 0 1 ${x.toFixed(1)} ${(COUPLING.y + dy).toFixed(1)}`;
}

export function NfcScanIllustration() {
  return (
    <div className="mx-auto w-full max-w-sm">
      <svg
        viewBox="0 0 320 240"
        fill="none"
        className="h-auto w-full"
        // Decorative: the heading and the status line below already say what
        // this is, so a screen reader gains nothing from a description of it.
        aria-hidden
      >
        <defs>
          {/* The field falls off with distance, which is the whole reason the
              document has to be held CLOSE. A gradient says that without a
              caption. */}
          <radialGradient id="kyc-nfc-field" cx="0" cy="0" r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform={`translate(${COUPLING.x} ${COUPLING.y}) scale(90)`}
          >
            <stop stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="0.55" stopColor="currentColor" stopOpacity="0.06" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ── The document, tucked BEHIND the phone ─────────────────────────
            THREE elements and nothing else: a portrait (this document is about
            a PERSON), the chip (the thing being read), and the MRZ (which
            BAC/PACE derive the chip's access keys from). Name/number ghost
            bars were tried and cut — every element removed makes the three
            that matter read faster.

            The lower-left is hidden behind the phone (that is where it is
            being held); the blank upper-left band is left for the field to
            wash over. */}
        <g transform="rotate(7 212 112)">
          <rect
            x="154" y="30" width="114" height="164" rx="10"
            className="fill-muted/50 stroke-border" strokeWidth="2"
          />

          {/* Portrait, top-right — small, an ID photo not a poster. The person
              is drawn as an outline glyph floating in the frame rather than a
              filled bust cropped by it: at this size a clipped silhouette read
              as a blob, and an icon that touches its frame reads as spilling
              out of it. */}
          <rect
            x="224" y="46" width="32" height="42" rx="6"
            className="fill-foreground/10 stroke-border" strokeWidth="1.5"
          />
          <g className="stroke-muted-foreground/50" strokeWidth="2" strokeLinecap="round" fill="none">
            <circle cx="240" cy="61" r="5.5" />
            <path d="M231.5 77.5a8.5 8.5 0 0 1 17 0" />
          </g>

          {/* The chip — the familiar card contact pad, CENTRED on the card.
              With the text lines gone it is the card's focal middle, and the
              centre line is what makes the composition read as designed rather
              than leftover: photo weights the top-right, chip holds the axis,
              MRZ grounds the bottom. Sits below the field's arc zone, so the
              fan never touches it. Neutral tone: the FIELD owns the accent. */}
          <g className="stroke-muted-foreground/70" strokeWidth="1.5" fill="none">
            <rect x="200.5" y="133" width="21" height="16" rx="3" className="fill-foreground/10" />
            <path d="M200.5 138.3h21M200.5 143.7h21M211 138.3v5.4" />
          </g>

          {/* The MRZ: two rows of ghost text running the full width, the left
              end disappearing behind the phone the way the real zone runs edge
              to edge. In the BORDER tone, not the icon tone — it is background
              texture, and at the icons' weight it competed with the chip.
              Dropped low on the card, where the real zone lives. */}
          <g className="stroke-border" strokeWidth="3" strokeLinecap="round" fill="none">
            <path d="M170 174h84" strokeDasharray="6 4" />
            <path d="M166 184h88" strokeDasharray="4 5" strokeOpacity="0.7" />
          </g>
        </g>

        {/* ── The phone, in front, screen toward us ─────────────────────────
            Dynamic-island pill, a waiting screen, ghost caption bars — the
            minimum that reads "front of a phone, app open" at a glance. */}
        <g transform="translate(12 0) rotate(-5 112 126)">
          {/* Volume buttons, as nubs proud of the left edge — on the side away
              from the field, so hardware detail never crowds the signal. */}
          <rect x="57" y="84" width="3" height="14" rx="1.5" className="fill-foreground/25" />
          <rect x="57" y="103" width="3" height="14" rx="1.5" className="fill-foreground/25" />
          {/* One surface, edge to edge — no inner screen outline. A second
              rectangle inside the body read as a border around a border; a
              modern phone's face is a single dark sheet of glass, and the
              island + home indicator are what say "screen", not a frame.

              TWO stacked rects, deliberately: the tint token is an alpha fill
              (`muted/40`), and used alone it let the card ghost THROUGH the
              phone — a see-through phone in front of the very document it is
              supposed to be covering. The opaque base makes the glass solid;
              the tint on top keeps the screen shade. */}
          <rect x="60" y="30" width="104" height="192" rx="24" className="fill-background" />
          <rect
            x="60" y="30" width="104" height="192" rx="24"
            className="fill-muted/40 stroke-foreground/25" strokeWidth="2"
          />
          <rect x="99" y="46" width="26" height="8" rx="4" className="fill-foreground/25" />

          {/* Ghost caption bars where the instruction copy sits in the app.
              The screen deliberately shows nothing else: the live field beside
              the phone is the subject, and an icon on the screen was a second,
              smaller copy of it competing for the same glance. */}
          <rect x="87" y="170" width="50" height="5" rx="2.5" className="fill-border" />
          <rect x="96" y="181" width="32" height="4" rx="2" className="fill-border" opacity="0.6" />

          {/* Home indicator — the strongest single "this is the front" cue a
              modern phone has. */}
          <rect x="97" y="205" width="30" height="3.5" rx="1.75" className="fill-foreground/20" />
        </g>

        {/* ── The field ────────────────────────────────────────────────────
            Drawn OVER both objects: a field wraps what it couples, it is not a
            decal on either one. The glow washing onto the screen's edge is the
            phone "sensing" it. */}
        <g className="text-primary">
          <circle cx={COUPLING.x} cy={COUPLING.y} r="90" fill="url(#kyc-nfc-field)" />
          <g stroke="currentColor" strokeWidth="3.25" strokeLinecap="round" fill="none">
            <circle cx={COUPLING.x} cy={COUPLING.y} r="4.5" fill="currentColor" stroke="none" />
            {WAVES.map((w) => (
              <path
                key={w.r}
                d={wavePath(w.r)}
                strokeOpacity={w.opacity}
                className="animate-nfc-wave"
                style={{ animationDelay: w.delay }}
              />
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}
