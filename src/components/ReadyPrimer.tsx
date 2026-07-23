'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

/**
 * "Here's what happens next" screen, shown once before a capture step opens the
 * camera. It exists because the camera used to appear unannounced: a user who
 * doesn't know their ID or their face is about to be photographed fumbles the
 * first attempt, and a retake costs more than a sentence of warning.
 *
 * Structure is deliberately the minimal single-column pattern — one hero, at
 * most three expectations, one primary action — so it reads in a glance rather
 * than becoming a wall of terms. It carries no StepHeader so it can drop into a
 * step that already renders one, matching CameraPermissionPrimer.
 *
 * It sits BEFORE that permission primer: first what we're about to do, then the
 * OS prompt. Two asks in a row, each with a reason, and never a surprise.
 */
export interface ReadyPrimerProps {
  /** Hero glyph — the thing being captured (document, face). */
  icon: LucideIcon;
  title: string;
  body: string;
  /** What to expect. Three at most; past that nobody reads it. */
  checklist: { icon: LucideIcon; label: string }[];
  buttonLabel?: string;
  onReady: () => void;
  className?: string;
}

export function ReadyPrimer({
  icon: Icon,
  title,
  body,
  checklist,
  buttonLabel = "I'm ready",
  onReady,
  className,
}: ReadyPrimerProps) {
  return (
    <div className={cn('space-y-5 animate-fade-in', className)}>
      {/* Hero. The ring is the ONLY looping element on the screen — more than
          one competing animation reads as noise. globals.css switches it off
          under prefers-reduced-motion. */}
      <div className="flex flex-col items-center gap-4 rounded-xl border border-primary/15 bg-primary/5 px-6 py-9 text-center">
        <div className="relative flex items-center justify-center">
          <span
            aria-hidden
            className="absolute h-20 w-20 rounded-full border-2 border-primary/30 animate-pulse-ring"
          />
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
            <Icon className="h-7 w-7 text-primary" aria-hidden />
          </span>
        </div>
        <div className="space-y-1.5">
          <p className="text-base font-semibold text-foreground">{title}</p>
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
      </div>

      {/* Expectations — same row idiom as the consent screen's "during this
          process we will" list, so the two read as one flow. */}
      <ul className="space-y-3">
        {checklist.map(({ icon: RowIcon, label }) => (
          <li key={label} className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RowIcon className="h-4.5 w-4.5" aria-hidden />
            </span>
            <span className="text-sm font-medium text-foreground/90">{label}</span>
          </li>
        ))}
      </ul>

      {/* One primary action. h-12 clears the 44px touch minimum. */}
      <Button className="h-12 w-full text-base font-medium" onClick={onReady}>
        {buttonLabel}
      </Button>
    </div>
  );
}
