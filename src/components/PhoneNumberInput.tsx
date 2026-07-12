'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Input } from './ui/input';
import { CountryFlag } from './CountryFlag';
import { cn } from '../lib/utils';

// Phone input with a searchable dial-code country picker + as-you-type
// national formatting (libphonenumber-js). Emits the E.164 value and validity.
//
// The dropdown is rendered INLINE (no portal), exactly like BusinessCountrySelect:
// the SDK always runs inside its modal dialog, and a portaled popover lands
// outside the dialog's focus trap / pointer-events lock — which makes the list
// impossible to scroll or click. Inline keeps it in the dialog's DOM tree.

const REGION_NAMES = typeof Intl !== 'undefined' && 'DisplayNames' in Intl
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;

const countryName = (code: string): string => REGION_NAMES?.of(code) ?? code;

interface CountryOption {
  code: CountryCode;
  name: string;
  dialCode: string;
}

export interface PhoneNumberInputProps {
  /** Seed the dial-code picker (ISO-2). Falls back to NG. */
  defaultCountry?: string;
  disabled?: boolean;
  /** Fires on every edit with the E.164 value ('' until parseable) + validity. */
  onChange: (value: { e164: string; isValid: boolean; country: string }) => void;
}

export function PhoneNumberInput({ defaultCountry, disabled, onChange }: PhoneNumberInputProps) {
  const options = useMemo<CountryOption[]>(
    () =>
      getCountries()
        .map((code) => ({ code, name: countryName(code), dialCode: `+${getCountryCallingCode(code)}` }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const seed = (defaultCountry?.toUpperCase() ?? 'NG') as CountryCode;
  const [country, setCountry] = useState<CountryCode>(options.some((o) => o.code === seed) ? seed : 'NG');
  const [national, setNational] = useState('');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.code === country);

  const emit = (nextCountry: CountryCode, nextNational: string) => {
    const parsed = parsePhoneNumberFromString(nextNational, nextCountry);
    onChange({ e164: parsed?.number ?? '', isValid: parsed?.isValid() ?? false, country: nextCountry });
  };

  const handleNationalChange = (raw: string) => {
    const formatted = new AsYouType(country).input(raw);
    setNational(formatted);
    emit(country, formatted);
  };

  const pick = (code: CountryCode) => {
    setCountry(code);
    setOpen(false);
    setQuery('');
    emit(code, national); // re-parse the same digits under the new dial code
  };

  // Close on outside click / Escape; focus the search when opened.
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) { setOpen(false); setQuery(''); }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const filtered = query.trim()
    ? options.filter((o) => {
        const q = query.trim().toLowerCase();
        return o.name.toLowerCase().includes(q) || o.dialCode.includes(q) || o.code.toLowerCase() === q;
      })
    : options;

  return (
    <div ref={rootRef} className="relative flex items-stretch gap-2">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-label="Country calling code"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-12 shrink-0 items-center gap-1.5 rounded-xl border border-input bg-background px-3 text-sm font-medium',
          'transition-colors hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50',
        )}
      >
        <CountryFlag code={country} className="h-5 w-5" title={selected?.name} />
        <span className="tabular-nums">{selected?.dialCode}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
      </button>

      <Input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="803 123 4567"
        value={national}
        onChange={(e) => handleNationalChange(e.target.value)}
        disabled={disabled}
      />

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-72 max-w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg animate-slide-up">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code"
              aria-label="Search countries"
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No matches</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.code}
                  type="button"
                  onClick={() => pick(o.code)}
                  className={cn(
                    'flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                    'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                    o.code === country && 'bg-primary/5 font-medium',
                  )}
                >
                  <CountryFlag code={o.code} className="h-5 w-5" title={o.name} />
                  <span className="flex-1 truncate">{o.name}</span>
                  <span className="tabular-nums text-muted-foreground">{o.dialCode}</span>
                  {o.code === country && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
