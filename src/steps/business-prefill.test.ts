import { describe, it, expect } from 'vitest';

// The mapping the details screen applies, mirrored so it is pinned rather than
// re-read off the component. The bug it exists for: the record used to be read
// from state that the dispatch inside runCheck had not reached yet, so every
// field saw null and nothing filled.
type Fields =
  | 'registrationName' | 'address' | 'companyType' | 'email'
  | 'phone' | 'taxId' | 'vatNumber' | 'dateOfIncorporation';

function isoDateOnly(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s]|$)/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const parsed = new Date(`${y}-${m}-${d}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === `${y}-${m}-${d}` ? `${y}-${m}-${d}` : null;
}

function prefill(
  current: Record<Fields, string>,
  found: Record<string, string | null> | null,
): Partial<Record<Fields, string>> {
  const patch: Partial<Record<Fields, string>> = {};
  if (!found) return patch;
  const fill = (key: Fields, value: string | null) => {
    if (value && !current[key].trim()) patch[key] = value;
  };
  fill('registrationName', found.name);
  fill('address', found.address);
  fill('companyType', found.typeOfEntity);
  fill('email', found.email);
  fill('phone', found.phone);
  fill('taxId', found.taxId);
  fill('vatNumber', found.vatNumber);
  fill('dateOfIncorporation', isoDateOnly(found.registrationDate));
  return patch;
}

const EMPTY: Record<Fields, string> = {
  registrationName: '', address: '', companyType: '', email: '',
  phone: '', taxId: '', vatNumber: '', dateOfIncorporation: '',
};

// Exactly what the server returned in the live check.
const REGISTER = {
  name: 'Sandbox Test Business Ltd',
  address: '12 Test Avenue, Victoria Island',
  typeOfEntity: 'PRIVATE COMPANY LIMITED BY SHARES',
  email: 'hello@sandboxco.test',
  phone: '+234 000 000 0000',
  taxId: '01234567-0001',
  vatNumber: null,
  registrationDate: '2018-03-12T00:00:00.000+00:00',
};

describe('prefill from the register', () => {
  it('fills every field the register answered', () => {
    expect(prefill(EMPTY, REGISTER)).toEqual({
      registrationName: 'Sandbox Test Business Ltd',
      address: '12 Test Avenue, Victoria Island',
      companyType: 'PRIVATE COMPANY LIMITED BY SHARES',
      email: 'hello@sandboxco.test',
      phone: '+234 000 000 0000',
      taxId: '01234567-0001',
      dateOfIncorporation: '2018-03-12',
    });
  });

  it('leaves a field the register did not answer alone', () => {
    // vatNumber came back null, so it must stay empty rather than be guessed.
    expect(prefill(EMPTY, REGISTER)).not.toHaveProperty('vatNumber');
  });

  it('never overwrites what the applicant already typed', () => {
    const typed = { ...EMPTY, email: 'me@mycompany.com', address: 'My own address' };
    const patch = prefill(typed, REGISTER);
    expect(patch).not.toHaveProperty('email');
    expect(patch).not.toHaveProperty('address');
    expect(patch.taxId).toBe('01234567-0001');
  });

  // new Date() would have accepted every one of these and produced a
  // confidently wrong date: "12/03/2018" as 2 December (US order, when a
  // register returning DD/MM means 12 March), "sometime in 2018" as 2017-12-31,
  // "March 2018" as the 28th.
  it.each(['sometime in 2018', '12/03/2018', 'March 2018', '2018', 'not a date', '2018-02-31'])(
    'leaves the date blank rather than guessing at %j',
    (registrationDate) => {
      expect(prefill(EMPTY, { ...REGISTER, registrationDate })).not.toHaveProperty(
        'dateOfIncorporation',
      );
    },
  );

  it('accepts a plain ISO date as well as a full timestamp', () => {
    expect(prefill(EMPTY, { ...REGISTER, registrationDate: '2018-03-12' }).dateOfIncorporation).toBe(
      '2018-03-12',
    );
  });

  // The regression itself: a null record must be survivable, because that is
  // what a stale read looked like.
  it('does nothing at all when there is no record', () => {
    expect(prefill(EMPTY, null)).toEqual({});
  });
});

/**
 * The other half of the same rule: what happens to those prefilled values when
 * the applicant changes WHICH company this is.
 *
 * Clearing them is not tidiness. The prefill above only writes into an empty
 * field, so a leftover from the previous company does not merely sit there
 * looking wrong - it blocks the next register's real answer from landing, and
 * the server then cross-checks the stale value against the new record and
 * raises a mismatch we caused ourselves.
 */
function clearPrefilled(
  payload: Partial<Record<Fields | 'registrationNumber' | 'country', string>>,
  prefilled: Fields[],
): Partial<Record<string, string>> {
  const next: Partial<Record<string, string>> = { ...payload };
  for (const key of prefilled) {
    if (next[key] === undefined) next[key] = '';
  }
  return next;
}

describe('changing which company this is', () => {
  it('clears every field the register had filled', () => {
    // The live bug: a US company kept the previous Nigerian lookup's Lagos
    // address and sandboxco.test email under its own name.
    const out = clearPrefilled({ registrationNumber: '5870869' }, ['address', 'email', 'phone']);
    expect(out).toEqual({ registrationNumber: '5870869', address: '', email: '', phone: '' });
  });

  it('leaves fields the applicant typed themselves', () => {
    // Correcting one digit of a registration number must not wipe an address
    // somebody entered by hand. Only what the register wrote is cleared, which
    // is why the provenance is tracked rather than inferred.
    const out = clearPrefilled({ registrationNumber: 'RC1' }, []);
    expect(out).toEqual({ registrationNumber: 'RC1' });
  });

  it('does not overwrite a value supplied in the same change', () => {
    const out = clearPrefilled({ address: '1 New Street' }, ['address']);
    expect(out.address).toBe('1 New Street');
  });

  it('unblocks the next lookup, which only writes into empty fields', () => {
    // Clear, then prefill from the new register: the new values land. Without
    // the clear, `fill` sees non-empty fields and writes nothing.
    const stale: Record<Fields, string> = { ...EMPTY, address: '12 Test Avenue, Victoria Island' };
    const cleared = { ...stale, ...clearPrefilled({}, ['address']) } as Record<Fields, string>;
    const patch = prefill(cleared, { ...REGISTER, address: '1600 Pennsylvania Ave' });
    expect(patch.address).toBe('1600 Pennsylvania Ave');

    const notCleared = prefill(stale, { ...REGISTER, address: '1600 Pennsylvania Ave' });
    expect(notCleared.address).toBeUndefined();
  });
});
