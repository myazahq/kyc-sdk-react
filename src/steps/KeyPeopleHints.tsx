'use client';

import React from 'react';

/**
 * The step's dashed hint boxes: skippable when the workflow sets no minimum
 * (the registry lookup fills the gaps), or the running count towards one.
 */
export function KeyPeopleHints({
  rowCount,
  minEntries,
  validCount,
}: {
  rowCount: number;
  minEntries: number;
  validCount: number;
}) {
  if (rowCount === 0 && minEntries === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        You can skip this if you’re unsure. We’ll identify directors and owners from the
        official registry. Adding them here speeds up the review.
      </div>
    );
  }
  if (minEntries > 0 && validCount < minEntries) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        List at least {minEntries} {minEntries === 1 ? 'person' : 'people'} to continue
        {validCount > 0 ? ` (${validCount} of ${minEntries} added)` : ''}.
      </div>
    );
  }
  return null;
}
