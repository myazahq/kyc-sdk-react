'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Held while the register is reconciled against what the applicant typed.
 *
 * A SKELETON of the roster it becomes, not a spinner line. Two reasons:
 *
 * - A one-line pill swapping into a tall grouped list is a layout jump right
 *   under the reader's eyes (the CLS anti-pattern); ghost cards drawn at the
 *   real cards' geometry reserve the space, so the answer lands in place.
 * - The ghost shape SAYS what is coming — a list of people — where a spinner
 *   only says "busy". For a KYB application, "people are about to be listed
 *   here" is the message; a blank reads as "nobody needs to verify", the
 *   opposite of true.
 *
 * The status line is a polite live region so screen-reader users hear why the
 * screen is not finished. Every shimmer respects prefers-reduced-motion.
 * Seconds, normally; the hook behind it gives up rather than spinning forever.
 */

const SHIMMER = 'animate-pulse motion-reduce:animate-none';

function GhostCard({ withLink, delayMs }: { withLink?: boolean; delayMs?: number }) {
  const delay = delayMs ? { animationDelay: `${delayMs}ms` } : undefined;
  return (
    <div className="space-y-3 rounded-2xl bg-muted/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className={`h-4 w-2/5 rounded bg-muted-foreground/15 ${SHIMMER}`} style={delay} />
          <div className={`h-3 w-3/5 rounded bg-muted-foreground/10 ${SHIMMER}`} style={delay} />
        </div>
        <div className={`h-6 w-24 shrink-0 rounded-full bg-muted-foreground/10 ${SHIMMER}`} style={delay} />
      </div>
      {withLink && (
        <div className={`h-10 w-full rounded-full bg-primary/10 ${SHIMMER}`} style={delay} />
      )}
    </div>
  );
}

export function KeyPeoplePending() {
  return (
    <div className="w-full space-y-4 text-left animate-fade-in motion-reduce:animate-none">
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-1 text-center"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
          Working out who else needs to verify
        </span>
        {/* Naming the authority is the reassurance: the pause is the official
            register being consulted, not the app hanging. */}
        <span className="text-xs text-muted-foreground">
          We are checking the official register for the company's directors and owners.
        </span>
      </div>

      {/* The ghost roster. aria-hidden: it is geometry, not information — the
          live region above already tells assistive tech what is happening. */}
      <div className="space-y-2" aria-hidden>
        <div className={`h-3 w-16 rounded bg-muted-foreground/10 ${SHIMMER}`} />
        <GhostCard withLink />
        <GhostCard delayMs={150} />
      </div>
    </div>
  );
}
