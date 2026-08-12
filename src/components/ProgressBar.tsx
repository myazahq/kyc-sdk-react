'use client';

import React from 'react';

// The quiet alternative to StepIndicator: a single thin bar sitting ON the
// header's bottom edge, replacing its border rather than adding a row beneath
// it — so choosing it costs the header no height at all.
//
// Unlike the step circles it does not say WHICH step you are on or how many
// there are, which is the trade: it is unaffected by step count, so a 14-step
// KYB flow draws exactly like a 4-step one. Hosts who would rather the chrome
// said less opt in with `progressStyle: 'bar'`.
//
// Deliberately NOT the shared ui/progress.tsx: that one is a Radix Progress used
// inside capture steps (upload, liveness) with its own track colour and height,
// and this needs the header's border colour, a heavier bar, and a rounded right
// cap. Reusing it would have coupled the header's chrome to a component three
// steps also depend on.

export interface ProgressBarProps {
  /** 0.0–1.0 progress fraction. */
  progress: number;
  /** Steps in the flow — announced, not drawn. */
  stepCount: number;
}

/**
 * Thickness of the bar.
 *
 * 5, not the 1px border it replaces: at hairline weight it read as a rendering
 * artefact rather than a deliberate indicator, and the filled portion needs
 * enough body for its colour to register against the track at a glance.
 */
const HEIGHT = 5;

export function ProgressBar({ progress, stepCount }: ProgressBarProps): React.ReactElement {
  const fraction = Math.min(Math.max(progress, 0), 1);
  const step = Math.min(Math.max(Math.round(fraction * stepCount), 1), stepCount);

  return (
    <div
      // The track doubles as the header's bottom border, which is why the header
      // drops its own when this is shown.
      className="absolute inset-x-0 bottom-0 z-10 bg-border"
      style={{ height: HEIGHT }}
      role="progressbar"
      aria-label={`Step ${step} of ${stepCount}`}
      aria-valuemin={1}
      aria-valuemax={stepCount}
      aria-valuenow={step}
    >
      {/* Animated so advancing a step reads as movement rather than a jump — the
          motion IS the feedback that the step was accepted. 250ms sits inside
          the 150–300ms micro-interaction band; ease-out because it is entering.
          A CSS transition does not run on the initial value, so a flow resumed
          mid-way paints at its true position instead of sweeping in from empty. */}
      <div
        className="h-full bg-primary transition-[width] duration-[250ms] ease-out motion-reduce:transition-none"
        style={{
          width: `${fraction * 100}%`,
          borderTopRightRadius: HEIGHT / 2,
          borderBottomRightRadius: HEIGHT / 2,
        }}
      />
    </div>
  );
}
