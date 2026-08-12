'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';

import { cn } from '../lib/utils';
import { fitStepCircles, windowedSteps, type StepSlot } from '../lib/step-window';

// Segmented numbered step indicator — 1:1 with the React Native SDK's
// StepIndicator and the Flutter SDK's _StepIndicator. N numbered circles joined
// by thin connectors:
//   • completed → filled primary + number + a check BADGE
//   • active    → filled primary + number
//   • upcoming  → outlined + muted number
// activeIndex = round(progress * stepCount) - 1.
//
// Long flows COLLAPSE rather than overflow, but only as a LAST RESORT: the row
// measures itself and shows as many real circles as the width allows, windowing
// around the current step (first and last always shown) only once the connectors
// would stop reading as a chain. See lib/step-window.

export interface StepIndicatorProps {
  /** 0.0–1.0 progress fraction. */
  progress: number;
  stepCount: number;
}

/** Base circle diameter, at a 16px root font size. */
const CIRCLE = 26;

/**
 * Measure before paint so the row never renders wide and then snaps to a
 * collapsed layout. `useLayoutEffect` warns during SSR (there is no DOM to
 * measure), so fall back to `useEffect` on the server — where nothing paints
 * anyway.
 */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function StepIndicator({ progress, stepCount }: StepIndicatorProps): React.ReactElement {
  const active = Math.round(progress * stepCount) - 1;
  const current = Math.min(Math.max(active + 1, 1), stepCount);

  const rowRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // Grow the circle with the reader's base font size, or the number inside it
  // clips the moment they turn text up — the web analogue of the RN SDK's
  // Dynamic Type handling. Capped at 1.4: past that the row matters less than
  // the step content below it, and an indicator that pushes the title off
  // screen helps nobody.
  const [scale, setScale] = useState(1);
  const size = Math.round(CIRCLE * scale);
  const badge = Math.round(13 * scale);

  const measure = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    // contentRect excludes this row's own padding, so it is already the space
    // the circles actually have.
    const w = el.getBoundingClientRect().width - getHorizontalPadding(el);
    // Only react to real changes (resize, zoom, orientation). Setting state on
    // every observer callback would re-render the row for nothing.
    setWidth((prev) => (Math.abs(prev - w) > 1 ? w : prev));

    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
    if (Number.isFinite(rootPx) && rootPx > 0) setScale(Math.min(rootPx / 16, 1.4));
  }, []);

  useIsomorphicLayoutEffect(() => {
    measure();
    const el = rowRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const slots = windowedSteps(stepCount, active, fitStepCircles(width, size));

  return (
    <div
      ref={rowRef}
      className="flex items-center px-6"
      // ONE label for the whole row. A screen reader walking ten unlabelled
      // circles announces a bare "6", which says nothing about how far through
      // the flow that is — hence the children are all aria-hidden.
      role="progressbar"
      aria-label={`Step ${current} of ${stepCount}`}
      aria-valuemin={1}
      aria-valuemax={stepCount}
      aria-valuenow={current}
    >
      {slots.map((slot: StepSlot, position) => {
        const isEllipsis = slot === 'ellipsis';
        const completed = !isEllipsis && slot < active;
        const isActive = !isEllipsis && slot === active;
        const filled = completed || isActive;
        return (
          <React.Fragment key={isEllipsis ? `gap-${position}` : `step-${slot}`}>
            {isEllipsis ? (
              // Collapsed run. Sized to the circle's height so the connectors on
              // either side stay on the same centre line and the chain reads as
              // continuous rather than broken in two.
              <div
                className="flex shrink-0 items-center px-[2px] leading-none text-muted-foreground"
                style={{ height: size, fontSize: 13, letterSpacing: 1 }}
                aria-hidden
              >
                ···
              </div>
            ) : (
              // Positioning context for the badge, which straddles the circle's
              // edge. Nothing here clips, so the overhang renders.
              <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
                <div
                  className={cn(
                    'flex h-full w-full items-center justify-center rounded-full border-[1.5px] font-bold leading-none',
                    filled
                      ? 'border-primary bg-primary text-white'
                      : 'border-primary/30 text-muted-foreground',
                  )}
                  // Fixed, not scaled: the circle already grows with the root
                  // font size, so scaling the glyph again would overflow it.
                  style={{ fontSize: 12 }}
                >
                  {/* The NUMBER stays, completed or not. A check alone says a
                      step is done but not WHICH step — and once the row is
                      windowed ("1 ··· 5 6 7 ··· 10") that is precisely what the
                      numbers are there to answer. */}
                  {slot + 1}
                </div>

                {/* Completion rides as a badge tucked onto the circle's corner.
                    The ring is WHITE — the same colour as the number inside the
                    circle — because the badge sits on the circle, not on the
                    page. Ringing it in the page background would paint a
                    near-black blob around the check on the dark theme. */}
                {completed ? (
                  <span
                    className="absolute flex items-center justify-center rounded-full border border-white bg-emerald-500"
                    // 1px ring, not 1.5: on a 13px badge a 1.5px ring eats
                    // nearly a quarter of the diameter and reads as a white
                    // outline rather than a hairline separating badge from
                    // circle.
                    style={{ top: -3, right: -2, width: badge, height: badge }}
                  >
                    <Check
                      className="text-white"
                      strokeWidth={3}
                      style={{ width: Math.round(badge * 0.6), height: Math.round(badge * 0.6) }}
                    />
                  </span>
                ) : null}
              </div>
            )}
            {position < slots.length - 1 ? (
              <div
                className={cn(
                  'mx-[3px] h-0.5 flex-1 rounded-sm',
                  // UNIFORM margins, deliberately: fitStepCircles budgets 3+3
                  // per connector, so widening this for completed steps made the
                  // row need more space than was reserved.
                  completed ? 'bg-primary' : 'bg-primary/30',
                )}
                // Floor, so an unforeseen overflow degrades to a visibly short
                // connector rather than a row of circles with no chain at all.
                style={{ minWidth: 6 }}
                aria-hidden
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** Horizontal padding of `el`, so the measured width is the usable width. */
function getHorizontalPadding(el: HTMLElement): number {
  const s = getComputedStyle(el);
  return (parseFloat(s.paddingLeft) || 0) + (parseFloat(s.paddingRight) || 0);
}
