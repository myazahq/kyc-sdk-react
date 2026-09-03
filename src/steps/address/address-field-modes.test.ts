import { describe, expect, it } from 'vitest';
import {
  addressFieldModes,
  displayedAddressValue,
  missingRequiredAddressFields,
  requiredPrefillSubmission,
} from './address-field-modes';
import type { KYCState } from '../../context/types';

// LOCKSTEP with the server's lib/workflows/address-fields.ts (kyc-core) —
// the resolution rule must agree or the SDK gates what the server accepts.

type Address = NonNullable<KYCState['address']>;
const address = (over: Partial<Address> = {}): Address =>
  ({
    lat: 4.94,
    lng: 8.33,
    propertyName: '',
    propertyNumber: '',
    directions: '',
    parts: { street: 'Bassey Street', area: 'Idim Ita', city: 'Calabar', state: 'Cross River', postcode: '540281', country: 'NG' },
    ...over,
  }) as Address;

describe('addressFieldModes (server-mirror)', () => {
  it('propertyFields required requires the NUMBER only', () => {
    const modes = addressFieldModes({ propertyFields: 'required' });
    expect(modes.propertyNumber).toBe('required');
    expect(modes.propertyName).toBe('optional');
  });
  it('fields overrides beat the group default', () => {
    const modes = addressFieldModes({ propertyFields: 'off', fields: { city: 'required' } });
    expect(modes.city).toBe('required');
    expect(modes.street).toBe('off');
  });
});

describe('displayed values and the required gate', () => {
  it('a required field showing its map prefill is NOT missing', () => {
    expect(displayedAddressValue('city', address())).toBe('Calabar');
    expect(missingRequiredAddressFields({ fields: { city: 'required' } }, address())).toEqual([]);
  });
  it('a required field with no typed value and no prefill blocks', () => {
    expect(
      missingRequiredAddressFields({ propertyFields: 'required' }, address()),
    ).toEqual(['propertyNumber']);
  });
  it('a deliberately CLEARED prefill counts as missing', () => {
    expect(
      missingRequiredAddressFields({ fields: { city: 'required' } }, address({ city: '' })),
    ).toEqual(['city']);
  });
});

describe('requiredPrefillSubmission', () => {
  it('carries the displayed prefill for required untouched fields only', () => {
    const out = requiredPrefillSubmission(
      { fields: { city: 'required', state: 'required', street: 'optional' } },
      address({ state: 'Cross River State' }), // typed state — not included
    );
    expect(out).toEqual({ city: 'Calabar' });
  });
});
