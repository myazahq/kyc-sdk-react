'use client';

import React from 'react';
import { cn } from '../lib/utils';

/**
 * Total-ownership summary at the DECISION point — the disabled Continue
 * button always explains itself, wherever the offending card is. Combined
 * ownership above 100% is factually impossible; under is fine (not every
 * owner has to be listed).
 */
export function KeyPeopleTotals({
  totalPct,
  overAllocated,
}: {
  totalPct: number;
  overAllocated: boolean;
}) {
  if (totalPct <= 0) return null;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return (
    <>
      <div
        className={cn(
          'flex items-center justify-between rounded-xl px-4 py-3 text-sm',
          overAllocated ? 'bg-destructive/5 text-destructive' : 'bg-muted/40 text-muted-foreground',
        )}
      >
        <span>Total ownership listed</span>
        <span className="font-semibold">{fmt(totalPct)}%</span>
      </div>
      {overAllocated && (
        <p className="text-sm text-destructive">
          Together the percentages can’t exceed 100%, so reduce them by {fmt(totalPct - 100)}%.
        </p>
      )}
    </>
  );
}
