'use client';

import React, { useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { CountryFlag } from './CountryFlag';
import { groupCountriesByRegion, regionCountryName } from '../lib/regions';
import type { AnyCountry } from '../types/config';

/**
 * Searchable, region-grouped country picker for the country-select step. Used
 * when a workflow offers many countries (Global Documents) — a flat 200-country
 * list is unusable, so this adds a pinned search box and continent headers over
 * a bounded scroll area. Big touch targets (this is a primary step, not a form
 * field), with SVG flags for cross-platform consistency.
 */
export function CountryRegionPicker({
  countries,
  selected,
  onPick,
}: {
  countries: string[];
  selected: string | null;
  onPick: (country: AnyCountry) => void;
}) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = q
      ? countries.filter(
          (c) => regionCountryName(c).toLowerCase().includes(q) || c.toLowerCase().includes(q),
        )
      : countries;
    return groupCountriesByRegion(visible);
  }, [countries, query]);

  return (
    // Fill the parent (the step body is flex-col h-full): search pinned, list
    // flexes to the remaining height with its own scroll.
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-2 rounded-xl border border-input bg-background px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search countries…"
          aria-label="Search countries"
          className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
        />
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
        {groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No countries found.</p>
        ) : (
          groups.map((group) => (
            <div key={group.region} className="space-y-2">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {group.region}
              </p>
              <div className="flex flex-col gap-2">
                {group.countries.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => onPick(c.code)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors',
                      selected === c.code
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                        : 'border-border hover:border-primary/40 hover:bg-muted/40',
                    )}
                  >
                    <CountryFlag code={c.code} className="h-8 w-8" title={c.name} />
                    <span className="flex-1 text-base font-medium">{c.name}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
