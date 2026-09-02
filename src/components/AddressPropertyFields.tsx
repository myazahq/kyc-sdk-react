'use client';

import React from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';

// The typed property fields — the ONLY honest source of a house number (map
// data carries street names, never trustworthy plot numbers; OkHi's own "42"
// is user-typed for the same reason). The server merges them with the street
// it derives from the pin into the composed address line. Both always
// optional: an applicant in an unnamed or unnumbered compound cannot answer,
// and a field they cannot answer must never block them.

interface AddressPropertyFieldsProps {
  name: string;
  number: string;
  disabled?: boolean;
  onChange: (patch: { propertyName?: string; propertyNumber?: string }) => void;
}

export function AddressPropertyFields({ name, number, disabled, onChange }: AddressPropertyFieldsProps) {
  return (
    <div className="grid grid-cols-[1fr_7.5rem] gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address-property-name" className="text-sm font-semibold">
          Building or compound name <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="address-property-name"
          maxLength={80}
          placeholder="e.g. Sunrise Villa"
          value={name}
          disabled={disabled}
          onChange={(e) => onChange({ propertyName: e.target.value })}
          className="h-12 rounded-xl"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address-property-number" className="text-sm font-semibold">
          House no.<span className="font-normal text-muted-foreground"> (opt.)</span>
        </Label>
        <Input
          id="address-property-number"
          maxLength={20}
          placeholder="e.g. 11"
          value={number}
          disabled={disabled}
          onChange={(e) => onChange({ propertyNumber: e.target.value })}
          className="h-12 rounded-xl"
        />
      </div>
    </div>
  );
}

interface AddressDirectionsFieldProps {
  isBusiness?: boolean;
  required: boolean;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

/** The free-text directions field, extracted from the step (200-line rule). */
export function AddressDirectionsField({
  isBusiness,
  required,
  value,
  disabled,
  onChange,
}: AddressDirectionsFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="address-directions" className="text-sm font-semibold">
        {isBusiness ? 'Directions to the entrance' : 'Directions to this address'}
        {required ? '' : ' (optional)'}
      </label>
      <textarea
        id="address-directions"
        rows={3}
        maxLength={500}
        placeholder="e.g. black gate opposite the kiosk, second building after the junction"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />
    </div>
  );
}
