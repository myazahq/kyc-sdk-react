'use client';

import React from 'react';
import { useText } from '../i18n';

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
  const t = useText();
  if (rowCount === 0 && minEntries === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        {t('keyPeople.hints.skippable')}
      </div>
    );
  }
  if (minEntries > 0 && validCount < minEntries) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        {t(
          minEntries === 1
            ? validCount > 0
              ? 'keyPeople.hints.minimumOneProgress'
              : 'keyPeople.hints.minimumOne'
            : validCount > 0
              ? 'keyPeople.hints.minimumManyProgress'
              : 'keyPeople.hints.minimumMany',
          { count: minEntries, added: validCount },
        )}
      </div>
    );
  }
  return null;
}
