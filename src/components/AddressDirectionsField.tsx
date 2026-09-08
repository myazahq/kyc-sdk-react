'use client';

import React from 'react';

// The free-text directions field of the address details sheet. This file
// used to carry the typed building-name + house-number pair too, which the
// OkHi-style edit-details sheet retired on 2026-08-31 in favour of per-field
// rows; that export had no importers left and went with the rename.

interface AddressDirectionsFieldProps {
  isBusiness?: boolean;
  required: boolean;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

/** The free-text directions field. */
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
