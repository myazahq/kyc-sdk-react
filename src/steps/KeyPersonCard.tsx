'use client';

import React from 'react';
import { Pencil } from 'lucide-react';
import { CountryFlag } from '../components/CountryFlag';
import {
  KEY_PERSON_ROLE_LABELS,
  initialsOf,
  isKeyPersonRowValid,
} from '../lib/business-application';
import { regionCountryName } from '../lib/regions';
import { cn } from '../lib/utils';
import type { KeyPersonEntry } from '../context/types';

/**
 * One saved key person, summarised — monogram avatar with their ID-issuing
 * country flag badged on its corner, name, role · ownership meta, and the
 * country + email their invite will go to. The whole card opens the edit
 * sheet (the pencil is the affordance); removal lives INSIDE that sheet, so a
 * stray tap can never delete a person.
 *
 * Same visual language as the applicant step's "this is me" cards, so the two
 * screens read as one system.
 */
export function KeyPersonCard({ entry, onClick }: { entry: KeyPersonEntry; onClick: () => void }) {
  const name = entry.name.trim() || 'Unnamed person';
  const country = entry.country.trim() ? entry.country.trim().toUpperCase() : null;
  const pct = entry.ownershipPct.trim();
  // A row persisted by the old inline UI (or interrupted mid-edit) may be
  // incomplete — the card says so instead of silently blocking Continue.
  const incomplete = !isKeyPersonRowValid(entry);

  const meta = [KEY_PERSON_ROLE_LABELS[entry.role], pct ? `${pct}% ownership` : null]
    .filter(Boolean)
    .join(' · ');
  // The flag alone doesn't say WHICH country — spell it out, alongside the
  // email their invite goes to.
  const detail = [country ? regionCountryName(country) : null, entry.email.trim() || null]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      aria-label={`Edit ${name}`}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all',
        incomplete ? 'border-destructive' : 'border-border hover:border-primary/40 hover:bg-muted/40',
      )}
    >
      {/* Monogram avatar with the ID-issuing-country flag badge. */}
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {initialsOf(name)}
        {country && (
          <span className="absolute -bottom-0.5 -right-1 rounded-full ring-2 ring-background">
            <CountryFlag code={country} className="block h-4 w-4" />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{meta}</span>
        {incomplete ? (
          <span className="mt-0.5 block truncate text-xs text-destructive">
            Incomplete — tap to finish
          </span>
        ) : detail !== '' ? (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span>
        ) : null}
      </span>

      <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
