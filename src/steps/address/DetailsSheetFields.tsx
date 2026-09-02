'use client';

import React from 'react';
import { CountryFlag } from '../../components/CountryFlag';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

/**
 * The edit-details form fields (200-line split from DetailsSheet). Every
 * field is EDITABLE, OkHi-style (user decision 2026-08-31): the map's answer
 * prefills each area field, and the applicant can correct anything it got
 * wrong. A prefill only becomes their claim once they EDIT the field — an
 * untouched default is never submitted as typed.
 */
/** undefined = never touched (the map's prefill shows); '' = cleared. The
 *  distinction is what lets an applicant DELETE a wrong prefill without the
 *  field refilling itself under their cursor. */
export interface DetailValues {
  propertyNumber: string;
  street?: string;
  unit?: string;
  propertyName: string;
  directions: string;
  neighbourhood?: string;
  city?: string;
  state?: string;
  postcode?: string;
}

export type DetailPatch = Partial<DetailValues>;

export function Field({
  id,
  label,
  value,
  placeholder,
  maxLength,
  disabled,
  helper,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  maxLength: number;
  disabled?: boolean;
  helper?: string;
  onChange: (value: string) => void;
}) {
  // No per-field "(optional)": every field on this form is optional, the
  // subtitle says so once, and nine suffixes were wrapping the two-column
  // labels out of alignment.
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium leading-tight">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        className="h-11 rounded-xl"
      />
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

/** Read-only country tile: the flow's country is a fact of the verification,
 *  not an address field. Shaped like its sibling fields (label above, h-11
 *  box) so the grid stays rhythmic, but toned as information — muted fill,
 *  a flag, and no cursor pretending it edits. */
export function CountryRow({ country }: { country: string | null }) {
  if (!country) return null;
  let name = country;
  try {
    name = new Intl.DisplayNames(['en'], { type: 'region' }).of(country) ?? country;
  } catch {
    // The ISO code stands in where DisplayNames is unavailable.
  }
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium leading-tight">Country</span>
      <div className="flex h-11 items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3">
        <CountryFlag code={country} className="h-5 w-5 shrink-0" />
        <span className="truncate text-sm font-medium">{name}</span>
      </div>
      <p className="text-xs text-muted-foreground">From your verification</p>
    </div>
  );
}
