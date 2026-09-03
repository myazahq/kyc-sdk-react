'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { CountryFlag } from '../../components/CountryFlag';
import { DropdownSurface } from '../../components/DropdownSurface';
import { useDropdownAnchor } from '../../lib/use-dropdown-anchor';
import { eventPathIncludes } from '../../lib/event-path';
import { inferredCountry } from '../../lib/inferred-country';
import { ALL_REGION_CODES, groupCountriesByRegion, regionCountryName } from '../../lib/regions';
import { useKYCConfig } from '../../context/KYCConfigContext';
import { useKYCContext } from '../../context/KYCContext';
import { configScope } from '../../lib/scope';
import type { AnyCountry } from '../../types/config';

/**
 * The declared-country control for ADDRESS-SCOPED flows — mounted on the
 * Proof of Address step (the Didit PoA model: the applicant names their
 * market, then uploads the document). The pick drives the search filter, the
 * map's opening view, the PoA vendor market, and rides the submission as the
 * verification's country (the server accepts any ISO country on the address
 * scope; the pin stays the ground truth regardless).
 *
 * The MENU is markup-identical to BusinessCountrySelect's (the house
 * searchable country dropdown — keep the two in lockstep): portaled to the
 * dialog root via the shared anchor, search pinned, region groups, the
 * IP-derived country pinned on top tagged "Your location". Only the TRIGGER
 * differs — the eyebrow card, so the field says what it is.
 */
export function AddressCountryControl() {
  const config = useKYCConfig();
  const { state, dispatch } = useKYCContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const anchor = useDropdownAnchor(open, triggerRef, { width: 'trigger', menuRef });

  const scoped = configScope(config) === 'address';
  // The address scope has NO seeded country: the control reads "Select
  // country" until IP, GPS, or a picked address supplies one. Showing the
  // workflow's configured country would present a value nobody inferred or
  // chose as though it were the applicant's market.
  const value = scoped
    ? (state.selectedCountry ?? null)
    : (state.selectedCountry ?? config.country ?? null);
  const geo = inferredCountry(config.serverConfig?.geoCountry);

  // What the picker offers: the org's accepted list (proofOfAddress.countries,
  // the server refuses submissions outside it) — or the whole world when the
  // workflow doesn't limit it.
  const offered = useMemo(() => {
    const configured = (config.proofOfAddress?.countries ?? [])
      .map((c) => c.toUpperCase())
      .filter((c) => ALL_REGION_CODES.includes(c));
    return configured.length > 0 ? configured : ALL_REGION_CODES;
  }, [config.proofOfAddress?.countries]);

  // The inferred country, pinned — while the org accepts it and it matches the
  // search (a pin that ignores the search box is a row that will not go away).
  const pinned = useMemo(() => {
    if (!geo || !offered.includes(geo)) return null;
    const q = query.trim().toLowerCase();
    if (q && !regionCountryName(geo).toLowerCase().includes(q) && !geo.toLowerCase().includes(q)) {
      return null;
    }
    return geo;
  }, [geo, offered, query]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = q
      ? offered.filter(
          (code) => regionCountryName(code).toLowerCase().includes(q) || code.toLowerCase().includes(q),
        )
      : offered;
    return groupCountriesByRegion(pinned ? visible.filter((code) => code !== pinned) : visible);
  }, [query, pinned, offered]);

  // Close on outside click / Escape; focus the search box when opened.
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onPointerDown = (e: PointerEvent) => {
      // composedPath, not e.target: the SDK renders in a shadow frame and a
      // document listener sees retargeted events (see lib/event-path.ts).
      if (eventPathIncludes(e, rootRef.current, menuRef.current)) return;
      setOpen(false);
      setQuery('');
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!scoped) return null;

  // One accepted country = nothing to pick. Show it as a settled fact rather
  // than a dropdown that could only ever re-answer itself.
  if (offered.length === 1) {
    const only = offered[0]!;
    return (
      <div className="flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5">
        <CountryFlag code={only} className="h-6 w-6 shrink-0" title={regionCountryName(only)} />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Country
          </span>
          <span className="block truncate text-sm font-medium leading-tight">{regionCountryName(only)}</span>
        </span>
      </div>
    );
  }

  const pick = (code: string) => {
    dispatch({ type: 'SET_COUNTRY', payload: code as AnyCountry });
    setOpen(false);
    setQuery('');
  };

  const row = (code: string, tag?: string) => {
    const isSelected = code === value;
    return (
      <button
        key={code}
        type="button"
        onClick={() => pick(code)}
        className={cn(
          'flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-base transition-colors sm:text-sm',
          'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
          isSelected && 'bg-primary/5 font-medium',
        )}
      >
        <CountryFlag code={code} className="h-5 w-5" title={regionCountryName(code)} />
        <span className="truncate">{regionCountryName(code)}</span>
        {tag && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {tag}
          </span>
        )}
        {isSelected && <Check className="ml-auto h-4 w-4 shrink-0 text-primary" aria-hidden />}
      </button>
    );
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-label="Country"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          open ? 'border-primary/50 bg-primary/5' : 'border-border/60 bg-muted/20 hover:border-border',
        )}
      >
        {value && <CountryFlag code={value} className="h-6 w-6 shrink-0" title={regionCountryName(value)} />}
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Country
          </span>
          <span className="block truncate text-sm font-medium leading-tight">
            {value ? regionCountryName(value) : 'Select country'}
          </span>
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && anchor.host && createPortal(
        <DropdownSurface menuRef={menuRef}>
          <div
            style={anchor.style}
            className="z-50 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg animate-slide-up"
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search countries…"
                aria-label="Search countries"
                className="h-11 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
              />
            </div>
            <div className="overflow-y-auto p-1.5" style={{ maxHeight: anchor.maxHeight }}>
              {pinned && (
                <div className="mb-1 border-b border-border pb-1.5">{row(pinned, 'Your location')}</div>
              )}
              {groups.length === 0 && !pinned ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">No countries match.</p>
              ) : (
                groups.map((group) => (
                  <div key={group.region} className="mb-1 last:mb-0">
                    <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      {group.region}
                    </p>
                    {group.countries.map((c) => row(c.code))}
                  </div>
                ))
              )}
            </div>
          </div>
        </DropdownSurface>,
        anchor.host,
      )}
    </div>
  );
}
