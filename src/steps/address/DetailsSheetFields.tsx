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
  required,
  helper,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  maxLength: number;
  disabled?: boolean;
  /** Workflow-required (addressCollection.fields) — marked, and the pin
   *  step's Continue holds until it is filled. */
  required?: boolean;
  helper?: string;
  onChange: (value: string) => void;
}) {
  // No per-field "(optional)": optional is the default, the subtitle says so
  // once, and nine suffixes were wrapping the two-column labels out of
  // alignment. Required fields alone carry a mark.
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium leading-tight">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
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

/** The "Area and region" section (split from DetailsSheet, 200-line rule).
 *  Each field honours its workflow mode: 'off' hides it, 'required' marks it. */
export function AreaFields({
  modes,
  values,
  parts,
  shown,
  country,
  disabled,
  onChange,
}: {
  modes: Record<'neighbourhood' | 'city' | 'state' | 'postcode', 'off' | 'optional' | 'required'>;
  values: DetailValues;
  /** The map's answer — the prefill each area field shows while untouched. */
  parts: { area?: string | null; city?: string | null; state?: string | null; postcode?: string | null } | null;
  shown: (typed: string | undefined, part: string | null | undefined) => string;
  country: string | null;
  disabled?: boolean;
  onChange: (patch: DetailPatch) => void;
}) {
  const all = [modes.neighbourhood, modes.city, modes.state, modes.postcode];
  if (all.every((m) => m === 'off')) return null;
  return (
    <div className="space-y-3">
      <SectionHeading>Area and region</SectionHeading>
      {modes.neighbourhood !== 'off' && (
        <Field
          id="address-neighbourhood"
          label="Neighbourhood"
          value={shown(values.neighbourhood, parts?.area)}
          placeholder="e.g. Idim Ita"
          maxLength={80}
          disabled={disabled}
          required={modes.neighbourhood === 'required'}
          onChange={(v) => onChange({ neighbourhood: v })}
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        {modes.city !== 'off' && (
          <Field
            id="address-city"
            label="City"
            value={shown(values.city, parts?.city)}
            placeholder="e.g. Calabar"
            maxLength={80}
            disabled={disabled}
            required={modes.city === 'required'}
            onChange={(v) => onChange({ city: v })}
          />
        )}
        {modes.state !== 'off' && (
          <Field
            id="address-state"
            label="State"
            value={shown(values.state, parts?.state)}
            placeholder="e.g. Cross River"
            maxLength={80}
            disabled={disabled}
            required={modes.state === 'required'}
            onChange={(v) => onChange({ state: v })}
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {modes.postcode !== 'off' && (
          <Field
            id="address-postcode"
            label="Area code"
            value={shown(values.postcode, parts?.postcode)}
            placeholder="e.g. 540281"
            maxLength={12}
            disabled={disabled}
            required={modes.postcode === 'required'}
            onChange={(v) => onChange({ postcode: v })}
          />
        )}
        <CountryRow country={country} />
      </div>
    </div>
  );
}
