'use client';

import React from 'react';
import { cn } from '../lib/utils';

// ─── A text line that is on its way ─────────────────────────────────────────
//
// Drawn at the line's own height so the card around it does not move when the
// words land, and shaped like the answer (a rounded bar about the width of a
// short address) rather than a spinner: a spinner beside grey text says
// "busy", a bar where the text goes says "the line is coming" (user decision
// 2026-09-07). The pin summary and the review card use it while the reverse
// geocode is out. It pulses the way KeyPeoplePending's ghost roster does, so
// the SDK has one skeleton language, and holds still under reduced motion.
// The words still reach assistive tech through the status label: sighted
// users get the shape, a screen reader gets the sentence.
//
// Mirrored on RN (components/LineSkeleton.tsx) and Flutter
// (widgets/line_skeleton.dart).

const SHIMMER = 'animate-pulse motion-reduce:animate-none motion-reduce:opacity-70';

export function LineSkeleton({
  label,
  size = 'sm',
  width = '62%',
  className,
}: {
  /** What a screen reader hears, e.g. "Finding the address…". */
  label: string;
  /** `sm` stands in for a text-sm line (20px); `base` for text-base leading-snug (22px). */
  size?: 'sm' | 'base';
  /** How much of the line the bar covers; an address, not a paragraph. */
  width?: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn('flex items-center', size === 'sm' ? 'h-5' : 'h-[1.375rem]', className)}
    >
      <span
        aria-hidden
        className={cn('block rounded-full bg-primary/15', size === 'sm' ? 'h-3' : 'h-3.5', SHIMMER)}
        style={{ width }}
      />
    </span>
  );
}
