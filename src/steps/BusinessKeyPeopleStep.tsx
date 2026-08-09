'use client';

import React, { useState } from 'react';
import { UserRoundPlus } from 'lucide-react';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/ui/button';
import { useKYCContext } from '../context/KYCContext';
import { useKYCConfig } from '../context/KYCConfigContext';
import {
  MAX_KEY_PEOPLE_ROWS,
  invalidKeyPersonRows,
  isKeyPersonRowBlank,
  isKeyPersonRowValid,
  keyPeopleMinEntries,
  nextBusinessStep,
  prevBusinessStep,
} from '../lib/business-application';
import { KeyPersonCard } from './KeyPersonCard';
import { KeyPersonSheet } from './KeyPersonSheet';
import { cn } from '../lib/utils';
import type { KeyPersonEntry } from '../context/types';

const EMPTY_ROW: KeyPersonEntry = { name: '', role: 'director', email: '', country: '', ownershipPct: '' };

type SheetState = { mode: 'add' } | { mode: 'edit'; index: number } | null;

/**
 * Business-key-people step ("Directors & owners"): the applicant lists the
 * company's directors and 25%+ owners. Skippable (zero rows is fine — the
 * registry lookup fills gaps). The list stays a clean stack of compact summary
 * cards; the FORM lives in the add/edit sheet (KeyPersonSheet). Tapping a card
 * edits it; removal is inside the edit sheet, behind a deliberate tap — never
 * one stray click on the list.
 */
export function BusinessKeyPeopleStep() {
  const { state, dispatch } = useKYCContext();
  const config = useKYCConfig();
  const rows = state.businessApplication.keyPeople;
  const [sheet, setSheet] = useState<SheetState>(null);
  // New people default to the business's registry country (most people are
  // local); a foreign director just switches theirs.
  const defaultCountry = state.business.country ?? config.business?.country ?? '';
  const minEntries = keyPeopleMinEntries(config.business);
  const uboThreshold = config.business?.keyPeople?.ownershipThreshold;

  const setRows = (keyPeople: KeyPersonEntry[]) =>
    dispatch({ type: 'SET_BUSINESS_APPLICATION', payload: { keyPeople } });

  const validCount = rows.filter(isKeyPersonRowValid).length;
  const invalidRows = invalidKeyPersonRows(rows);
  const meetsMinimum = validCount >= minEntries;

  // Combined ownership above 100% is factually impossible — catch the typo
  // here rather than shipping it into the registry cross-check as a doomed
  // mismatch. Under 100% is fine (not every owner has to be listed).
  const pctOf = (row: KeyPersonEntry): number => {
    const n = Number(row.ownershipPct);
    return row.ownershipPct.trim() !== '' && Number.isFinite(n) ? n : 0;
  };
  const totalPct = rows.reduce((sum, row) => sum + pctOf(row), 0);
  const overAllocated = totalPct > 100;
  const fmtPct = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  const canContinue = meetsMinimum && invalidRows.length === 0 && !overAllocated;

  // Indexed access may be undefined under strict indexing — resolved once here
  // so the sheet only ever mounts with a real entry.
  const editEntry = sheet?.mode === 'edit' ? rows[sheet.index] : undefined;

  const handleSave = (entry: KeyPersonEntry) => {
    if (sheet?.mode === 'edit') {
      setRows(rows.map((row, i) => (i === sheet.index ? entry : row)));
    } else {
      setRows([...rows, entry]);
    }
    setSheet(null);
  };
  const handleRemove = () => {
    if (sheet?.mode === 'edit') setRows(rows.filter((_, i) => i !== sheet.index));
    setSheet(null);
  };

  const handleContinue = () => {
    if (!canContinue) return;
    // Half-typed rows are dropped rather than submitted: an entry the user
    // abandoned is not a person they disclosed.
    setRows(rows.filter(isKeyPersonRowValid));
    const next = nextBusinessStep('business-key-people', config);
    if (next === 'submitted') {
      dispatch({ type: 'SUBMIT_VERIFICATION' });
    } else {
      dispatch({ type: 'SET_STEP', payload: next });
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <StepHeader
        title="Directors & owners"
        description="List the company's directors and owners of 25% or more. Each will receive a link to verify their identity."
        onBack={() =>
          dispatch({ type: 'SET_STEP', payload: prevBusinessStep('business-key-people', config.business) })
        }
      />

      {rows.length === 0 && minEntries === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          You can skip this if you’re unsure — we’ll identify directors and owners from the official
          registry. Adding them here speeds up the review.
        </div>
      )}
      {minEntries > 0 && validCount < minEntries && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          List at least {minEntries} {minEntries === 1 ? 'person' : 'people'} to continue
          {validCount > 0 ? ` (${validCount} of ${minEntries} added)` : ''}.
        </div>
      )}

      {rows.some((row) => !isKeyPersonRowBlank(row)) && (
        <div className="space-y-2">
          {rows.map((row, index) =>
            isKeyPersonRowBlank(row) ? null : (
              <KeyPersonCard key={index} entry={row} onClick={() => setSheet({ mode: 'edit', index })} />
            ),
          )}
        </div>
      )}

      {rows.length < MAX_KEY_PEOPLE_ROWS ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setSheet({ mode: 'add' })}
        >
          <UserRoundPlus className="mr-2 h-4 w-4" />
          Add a person
        </Button>
      ) : (
        <p className="text-center text-sm text-muted-foreground">
          You can list up to {MAX_KEY_PEOPLE_ROWS} people here.
        </p>
      )}

      {/* Total-ownership summary at the DECISION point — the disabled Continue
          button always explains itself, wherever the offending card is. */}
      {totalPct > 0 && (
        <div
          className={cn(
            'flex items-center justify-between rounded-xl px-4 py-3 text-sm',
            overAllocated ? 'bg-destructive/5 text-destructive' : 'bg-muted/40 text-muted-foreground',
          )}
        >
          <span>Total ownership listed</span>
          <span className="font-semibold">{fmtPct(totalPct)}%</span>
        </div>
      )}
      {overAllocated && (
        <p className="text-sm text-destructive">
          Together the percentages can’t exceed 100% — reduce them by {fmtPct(totalPct - 100)}%.
        </p>
      )}

      <Button onClick={handleContinue} disabled={!canContinue} className="w-full">
        Continue
      </Button>

      {sheet && (sheet.mode === 'add' || editEntry) && (
        <KeyPersonSheet
          mode={sheet.mode}
          initial={editEntry ?? { ...EMPTY_ROW, country: defaultCountry }}
          uboThreshold={uboThreshold}
          otherPctTotal={editEntry ? totalPct - pctOf(editEntry) : totalPct}
          onSave={handleSave}
          onRemove={sheet.mode === 'edit' ? handleRemove : undefined}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
