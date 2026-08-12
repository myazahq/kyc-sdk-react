'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { CountryFlag } from './CountryFlag';
import { cn } from '../lib/utils';
import { businessCountryName, groupBusinessCountries } from '../lib/business';
import { groupCountriesByRegion } from '../lib/regions';
import { useDropdownAnchor } from '../lib/use-dropdown-anchor';

/**
 * Registry-country picker for the business (KYB) details step: a searchable
 * dropdown grouped by continent, with SVG flags (emoji flags render
 * inconsistently across platforms).
 *
 * The menu is portaled to the dialog root (`.kyc-root`) rather than to
 * document.body: Radix Dialog sets `pointer-events: none` on the body while
 * open, so a menu there is unclickable. Staying inside the dialog keeps focus,
 * clicks and scrolling working while clearing the step body's
 * `overflow-y-auto`, which otherwise clips the list. See
 * lib/use-dropdown-anchor.
 */
export function BusinessCountrySelect({
  id,
  countries,
  value,
  onChange,
  groupAll = false,
}: {
  id?: string;
  countries: string[];
  value: string;
  onChange: (code: string) => void;
  /** Group with the FULL ISO region map (person-country pickers) instead of
   *  the business-registry map. */
  groupAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Full-width field, so the menu matches the control it hangs off.
  const anchor = useDropdownAnchor(open, triggerRef, { width: 'trigger', menuRef });

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = q
      ? countries.filter(
          (code) =>
            businessCountryName(code).toLowerCase().includes(q) || code.toLowerCase().includes(q),
        )
      : countries;
    if (groupAll) {
      return groupCountriesByRegion(visible).map((g) => ({ label: g.region, countries: g.countries }));
    }
    return groupBusinessCountries(visible);
  }, [countries, query, groupAll]);

  // Close on outside click / Escape; focus the search box when opened.
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      // The menu is portaled out of rootRef, so it needs its own test — without
      // it, picking a country would register as an outside click.
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
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

  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-label="Country of registration"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-12 w-full items-center gap-2.5 rounded-xl border border-input bg-background px-3 text-left text-base sm:text-sm',
          'ring-offset-background transition-colors hover:bg-accent/40',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
      >
        <CountryFlag code={value} className="h-5 w-5" title={businessCountryName(value)} />
        <span className="flex-1 truncate">{businessCountryName(value)}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
      </button>

      {open && anchor.host && createPortal(
        <div
          ref={menuRef}
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
            {groups.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No countries match.
              </p>
            ) : (
              groups.map((group) => (
                <div key={group.label} className="mb-1 last:mb-0">
                  <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {group.label}
                  </p>
                  {group.countries.map((c) => {
                    const isSelected = c.code === value;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => pick(c.code)}
                        className={cn(
                          'flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-base transition-colors sm:text-sm',
                          'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                          isSelected && 'bg-primary/5 font-medium',
                        )}
                      >
                        <CountryFlag code={c.code} className="h-5 w-5" title={c.name} />
                        <span className="flex-1 truncate">{c.name}</span>
                        {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>,
        anchor.host,
      )}
    </div>
  );
}
