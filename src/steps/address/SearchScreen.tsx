'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { AddressSearchBox } from '../../components/AddressSearchBox';
import { CurrentLocationRow } from './CurrentLocationRow';
import { useKYCConfig } from '../../context/KYCConfigContext';
import type { PlaceSuggestion } from '../../services/api';

// Screen 1: find the address the way a person holds it — as words. Places
// autocomplete when the platform has it (as-you-type, debounced, one session
// token per typing session — the billing unit), the explicit-submit basic
// search otherwise, and two always-present escapes: current location and
// "place a pin instead". Every path lands on the pin screen.

export interface ResolvedSearch {
  lat: number;
  lng: number;
  houseNumber: string | null;
  road: string | null;
  formatted?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
}

export function SearchScreen({
  country,
  locationHint,
  locating,
  onResolved,
  onUseMyLocation,
  onPinInstead,
}: {
  country?: string | null;
  /** The device's resolved current address, shown ON the button. */
  locationHint?: string | null;
  /** A fix attempt is still running. */
  locating?: boolean;
  onResolved: (hit: ResolvedSearch) => void;
  onUseMyLocation: () => void;
  onPinInstead: () => void;
}) {
  const config = useKYCConfig();
  const autocomplete = config.serverConfig?.addressSearchMode === 'autocomplete';
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[] | null>(null);
  const session = useRef(crypto.randomUUID());
  const debounce = useRef<number | null>(null);

  useEffect(() => {
    if (!autocomplete) return;
    if (debounce.current) window.clearTimeout(debounce.current);
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions(null);
      return;
    }
    debounce.current = window.setTimeout(() => {
      config.api
        .addressAutocomplete(q, session.current, country ?? undefined)
        .then((res) => setSuggestions(res.suggestions))
        .catch(() => setSuggestions([]));
    }, 300);
    return () => {
      if (debounce.current) window.clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, autocomplete, country]);

  const pick = async (s: PlaceSuggestion) => {
    setBusy(true);
    try {
      const { place } = await config.api.addressPlace(s.placeId, session.current);
      session.current = crypto.randomUUID(); // a details call closes the session
      onResolved(place);
    } catch {
      setSuggestions([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {autocomplete ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your address, e.g. 12 Adeola Odeku Street"
              className="h-12 rounded-xl pl-9"
              aria-label="Search your address"
              autoFocus
            />
            {busy && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
          </div>
          {suggestions && (
            <div className="overflow-hidden rounded-xl border border-border">
              {suggestions.length === 0 ? (
                <p className="px-3 py-2.5 text-sm text-muted-foreground">
                  No matches. Use your location or place the pin by hand.
                </p>
              ) : (
                suggestions.map((s) => (
                  <button
                    key={s.placeId}
                    type="button"
                    disabled={busy}
                    onClick={() => void pick(s)}
                    className="flex w-full items-start gap-2 border-b border-border/60 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/50 disabled:opacity-60"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-snug">{s.mainText}</span>
                      {s.secondaryText && (
                        <span className="block text-xs text-muted-foreground">{s.secondaryText}</span>
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <AddressSearchBox country={country} onPick={(hit) => onResolved({ ...hit, formatted: hit.label })} />
      )}

      <CurrentLocationRow hint={locationHint ?? null} locating={locating === true} onClick={onUseMyLocation} />

      <button
        type="button"
        onClick={onPinInstead}
        className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Place a pin on the map instead
      </button>
    </div>
  );
}
