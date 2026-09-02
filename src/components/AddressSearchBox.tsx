'use client';

import React, { useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { useKYCConfig } from '../context/KYCConfigContext';
import type { AddressSearchHit } from '../services/api';

// The address step's search box — the OkHi flow's best idea, in our order:
// type the address you know ("11 bassey street"), pick a candidate, and the
// pin lands there with the house number prefilled. Search fires on EXPLICIT
// submit only (Enter or the button) — the map source's policy forbids
// autocomplete, and the CAC rule applies: spend the request on the query the
// person meant. Dragging the pin always works; this is a shortcut, never a
// gate, so every failure degrades to "place the pin by hand".

export function AddressSearchBox({
  country,
  onPick,
}: {
  country?: string | null;
  onPick: (hit: AddressSearchHit) => void;
}) {
  const config = useKYCConfig();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<AddressSearchHit[] | null>(null);

  const search = async () => {
    const q = query.trim();
    if (q.length < 3 || searching) return;
    setSearching(true);
    try {
      const res = await config.api.addressSearch(q, country ?? undefined);
      setResults(res.results);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="Search your address, e.g. 12 Adeola Odeku Street"
          className="h-11 rounded-xl"
          aria-label="Search your address"
        />
        <Button
          variant="outline"
          onClick={() => void search()}
          disabled={query.trim().length < 3 || searching}
          className="h-11 w-11 shrink-0 rounded-xl p-0"
          aria-label="Search"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {results && (
        <div className="overflow-hidden rounded-xl border border-border">
          {results.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">
              No matches. Drag the map to place the pin instead.
            </p>
          ) : (
            results.map((hit, i) => (
              <button
                key={`${hit.lat},${hit.lng},${i}`}
                type="button"
                onClick={() => {
                  setResults(null);
                  setQuery('');
                  onPick(hit);
                }}
                className="flex w-full items-start gap-2 border-b border-border/60 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/50"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-sm leading-snug">{hit.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
