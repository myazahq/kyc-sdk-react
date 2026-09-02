import { describe, it, expect } from 'vitest';
import { pickedAddressState } from './address-helpers';

describe('pickedAddressState', () => {
  it('lands the pin and prefills the house number when none was typed', () => {
    expect(
      pickedAddressState(
        { directions: 'red gate', propertyName: '', propertyNumber: '' },
        { lat: 4.93, lng: 8.32, houseNumber: '11' },
      ),
    ).toEqual({
      lat: 4.93,
      lng: 8.32,
      accuracy: null,
      directions: 'red gate',
      propertyName: '',
      propertyNumber: '11',
      // Undefined = never touched, so the details sheet prefills the map's
      // resolved street ('' would read as deliberately cleared and hide it).
      street: undefined,
    });
  });

  it('keeps a typed street across a pick', () => {
    expect(
      pickedAddressState({ street: 'Wisdom Close' }, { lat: 1, lng: 2, houseNumber: null }).street,
    ).toBe('Wisdom Close');
  });

  it("never overwrites a number the applicant typed — their word beats the map's", () => {
    expect(
      pickedAddressState({ propertyNumber: '7B' }, { lat: 1, lng: 2, houseNumber: '11' }).propertyNumber,
    ).toBe('7B');
  });

  it('handles a first pick with no prior state', () => {
    const s = pickedAddressState(null, { lat: 1, lng: 2, houseNumber: null });
    expect(s).toMatchObject({ lat: 1, lng: 2, directions: '', propertyName: '', propertyNumber: '' });
  });
});
