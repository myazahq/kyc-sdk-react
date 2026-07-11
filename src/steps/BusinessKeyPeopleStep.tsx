'use client';

import React from 'react';
import { UserRoundPlus } from 'lucide-react';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/ui/button';
import { useKYCContext } from '../context/KYCContext';
import { useKYCConfig } from '../context/KYCConfigContext';
import {
  MAX_KEY_PEOPLE_ROWS,
  isKeyPersonRowValid,
  keyPeopleMinEntries,
  nextBusinessStep,
  prevBusinessStep,
} from '../lib/business-application';
import { BusinessKeyPersonRow } from './BusinessKeyPersonRow';
import type { KeyPersonEntry } from '../context/types';

const EMPTY_ROW: KeyPersonEntry = { name: '', role: 'director', email: '', country: '', ownershipPct: '' };

/**
 * Business-key-people step ("Directors & owners"): the applicant lists the
 * company's directors and 25%+ owners. Skippable (zero rows is fine — the
 * registry lookup fills gaps), but every row that exists must be valid. Each
 * person with an email receives a link to verify their own identity.
 */
export function BusinessKeyPeopleStep() {
  const { state, dispatch } = useKYCContext();
  const config = useKYCConfig();
  const rows = state.businessApplication.keyPeople;
  // New rows default to the business's registry country (most people are
  // local); a foreign director just switches theirs.
  const defaultCountry = state.business.country ?? config.business?.country ?? '';
  const minEntries = keyPeopleMinEntries(config.business);

  const setRows = (keyPeople: KeyPersonEntry[]) =>
    dispatch({ type: 'SET_BUSINESS_APPLICATION', payload: { keyPeople } });

  const updateRow = (index: number, patch: Partial<KeyPersonEntry>) =>
    setRows(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const allValid = rows.every(isKeyPersonRowValid);
  const validCount = rows.filter(isKeyPersonRowValid).length;
  const meetsMinimum = validCount >= minEntries;

  const handleContinue = () => {
    if (!allValid || !meetsMinimum) return;
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

      <div className="space-y-4">
        {rows.map((entry, index) => (
          <BusinessKeyPersonRow
            key={index}
            index={index}
            entry={entry}
            onChange={(patch) => updateRow(index, patch)}
            onRemove={() => setRows(rows.filter((_, i) => i !== index))}
          />
        ))}
      </div>

      {rows.length < MAX_KEY_PEOPLE_ROWS && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setRows([...rows, { ...EMPTY_ROW, country: defaultCountry }])}
        >
          <UserRoundPlus className="mr-2 h-4 w-4" />
          Add a person
        </Button>
      )}

      <Button onClick={handleContinue} disabled={!allValid || !meetsMinimum} className="w-full">
        Continue
      </Button>
    </div>
  );
}
