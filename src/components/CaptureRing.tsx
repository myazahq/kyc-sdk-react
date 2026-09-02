'use client';

import { useEffect, useRef } from 'react';
import { cn } from '../lib/utils';

// MIRRORED in the React Native SDK (lib/captureRing.ts + screens/liveness/
// CaptureRing.tsx) and the Flutter SDK (liveness/capture_ring.dart): the
// arithmetic below and in useLiveness's updateLivenessProgress is one rule in
// three languages — change it in one and change it in all three.
//
// A single line that traces the circular frame's edge for the length of the
// liveness test: empty when the test starts, a closed circle at the shutter.
// It is the FRAME'S OWN EDGE filling in rather than a spinner parked on top —
// anchoring an indicator to the thing it describes is what makes the two read
// as one object instead of a widget and a photo.
//
// It does not rotate, and it never goes backwards. What the user does changes
// its SPEED: the hook divides the test into equal segments (positioning, each
// challenge, the capture) and measures each by whatever actually gates it, so
// a steady face fills a segment quickly, a landed gesture jumps to the next,
// and a struggle crawls. The ring itself knows none of that. It follows one
// number, upward only, and writes one attribute per frame.
//
// Reduced motion is deliberately NOT honoured: globals.css sets the house rule
// that functional indicators keep moving, because a frozen one reads as a hang.
// Decorative loops are what that media query switches off.

/**
 * Ring geometry, ALL of it in the viewBox's own units — width and dashes alike.
 *
 * The first version scaled the stroke with `non-scaling-stroke` so it stayed
 * 4px at every frame size. That attribute makes the browser compute the whole
 * stroke, dashes included, in SCREEN pixels: a dash array of the 309-unit
 * circumference became 309px against a ring that is ~790px around on screen,
 * which drew two and a half arcs. That was the "more than one line". With every
 * length in one coordinate system there is nothing to disagree.
 *
 * The stroke therefore scales with the frame, which is proportional and fine.
 * It is sized to the 4px border it traces (1.6 units is 4.1px at 256px), so
 * the arc reads as the border filling in rather than a second, fatter ring
 * laid over it. `R` keeps `R + STROKE / 2` inside the 50-unit viewBox, because
 * an outer <svg> clips to its viewport.
 */
const STROKE = 1.6;
const R = 50 - STROKE / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : Number.isFinite(n) ? n : 0);

/**
 * Time constant of the display's approach to its target, in seconds. The
 * shown arc closes ~95% of any gap in three of these — quick enough that the
 * close still lands with the shutter flash, slow enough that nothing snaps.
 */
const TAU = 0.09;

/**
 * The TARGET: where the test has actually got to, and it only ever moves
 * forward. Pure, so it is tested as arithmetic.
 *
 * The number underneath genuinely drops when the face drifts (the hook's steady
 * -frame counters decay), but an arc that visibly unwound would read as the app
 * losing work already done, and would punish exactly the person struggling to
 * hold a phone still. Pacing is the hook's job; the ring never invents progress.
 */
export function advanceTarget(target: number, real: number): number {
  return Math.max(target, clamp01(real));
}

/**
 * The DISPLAY: eases toward the target rather than jumping to it.
 *
 * Two things arrive as steps and must not be drawn as steps. A gesture
 * landing moves the target to the next segment's start in one go — that is a
 * beat worth seeing, but as a quick advance, not a cut. And the face-mesh loop
 * that feeds the target runs at whatever rate inference allows, often half the
 * display's, so drawn raw the arc staircases even while the user holds
 * perfectly still.
 *
 * Exponential approach on real elapsed time: frame-rate independent, and
 * critically damped by construction — it can never overshoot, which matters
 * for a ring that must never appear to go backwards.
 */
export function easeToward(shown: number, target: number, dt: number): number {
  if (dt <= 0) return shown;
  return shown + (target - shown) * (1 - Math.exp(-dt / TAU));
}

export function CaptureRing({
  progressRef,
  className,
}: {
  /**
   * Live 0..1 progress through the test. A REF, not a prop value: it changes
   * every frame of the face-mesh loop, and routing that through React state
   * would re-render the whole liveness step ~30 times a second while the
   * detector is already the busiest thing on the page. The ring reads it in its
   * own rAF and writes one attribute.
   */
  progressRef: { current: number };
  className?: string;
}) {
  const circleRef = useRef<SVGCircleElement>(null);
  const targetRef = useRef(0);
  const shownRef = useRef(0);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // Clamped: rAF stops in a hidden tab, and the first frame back would
      // otherwise carry seconds of elapsed time and slam the arc to target.
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const circle = circleRef.current;
      if (circle) {
        targetRef.current = advanceTarget(targetRef.current, progressRef.current);
        shownRef.current = easeToward(shownRef.current, targetRef.current, dt);
        circle.setAttribute(
          'stroke-dashoffset',
          String(CIRCUMFERENCE * (1 - shownRef.current)),
        );
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [progressRef]);

  return (
    <svg
      // Sits on the frame's edge, over its border, so the arc and the border
      // are the same line.
      //
      // `-rotate-90` is a static origin, not motion: it puts the start of the
      // arc at twelve o'clock so it grows clockwise from the top. The ring
      // NEVER spins — a stroke growing from one end to the other is the whole
      // animation.
      className={cn('pointer-events-none absolute inset-0 h-full w-full -rotate-90', className)}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      <circle
        ref={circleRef}
        cx="50"
        cy="50"
        r={R}
        stroke="currentColor"
        strokeWidth={STROKE}
        // Flat ends: the arc is a length of the border, and a border has no
        // rounded tips.
        strokeLinecap="butt"
        // ONE dash, the length of the whole circumference, initially offset
        // entirely out of view: an empty circle. The loop above walks that
        // offset to zero, which grows a single stroke from one end to the
        // other and closes it.
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE}
      />
    </svg>
  );
}
