import { describe, expect, it } from 'vitest';
import { normalizeRestoredKeyPeople } from './key-person-normalize';
import { isKeyPersonRowValid, isKeyPersonRowBlank } from './business-application';

// The defect this pins: a restored snapshot's key-people rows are written by
// WHATEVER SDK build saved them, and the row shape has grown over time. The
// old restore backfilled only `roles`/`title`/`owners`, so a row missing
// `name`/`email`/`ownershipPct` crashed `isKeyPersonRowValid` (`.trim` of
// undefined) the moment the step rendered — a live workflow died on
// "Something went wrong". Restores degrade to restoring LESS, never to
// breaking the flow.

describe('normalizeRestoredKeyPeople', () => {
  it('coerces a pre-redesign row (missing most fields) into a readable one', () => {
    const rows = normalizeRestoredKeyPeople([{ name: 'Ada Obi', role: 'director' }])!;
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    // Every string field is a string — the crash shape.
    expect(() => isKeyPersonRowValid(row)).not.toThrow();
    expect(isKeyPersonRowValid(row)).toBe(true);
    expect(row.roles).toEqual(['director']);
    expect(row.email).toBe('');
    expect(row.ownershipPct).toBe('');
    expect(row.title).toBe('');
    expect(row.country).toBe('');
    expect(row.owners).toEqual([]);
    expect(row.isCorporate).toBe(false);
  });

  it('a row with nothing readable restores as a blank row, not a crash', () => {
    const rows = normalizeRestoredKeyPeople([{}])!;
    expect(rows).toHaveLength(1);
    expect(() => isKeyPersonRowBlank(rows[0]!)).not.toThrow();
    expect(isKeyPersonRowBlank(rows[0]!)).toBe(true);
  });

  it('keeps role as the strongest member of roles (the type invariant)', () => {
    const rows = normalizeRestoredKeyPeople([
      { name: 'Femi', roles: ['shareholder', 'beneficial_owner'] },
    ])!;
    expect(rows[0]!.role).toBe('beneficial_owner');
  });

  it('tolerates ownershipPct stored as a number, and unknown roles', () => {
    const rows = normalizeRestoredKeyPeople([
      { name: 'Ngozi', role: 'chairman-of-vibes', roles: ['not-a-role'], ownershipPct: 40 },
    ])!;
    expect(rows[0]!.ownershipPct).toBe('40');
    expect(rows[0]!.roles).toEqual(['director']);
  });

  it('drops non-object entries and unreadable owners, keeps readable ones', () => {
    const rows = normalizeRestoredKeyPeople([
      null,
      'garbage',
      { name: 'Hold Co Ltd', isCorporate: true, owners: [null, { name: 'Ada' }] },
    ])!;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.owners).toEqual([
      { name: 'Ada', ownershipPct: '', email: '', country: '' },
    ]);
  });

  it('returns null for a snapshot with no usable array (caller keeps state)', () => {
    expect(normalizeRestoredKeyPeople(undefined)).toBeNull();
    expect(normalizeRestoredKeyPeople('nope')).toBeNull();
  });

  it('passes a fully-formed current row through unchanged', () => {
    const row = {
      name: 'Amara Eze',
      role: 'beneficial_owner',
      roles: ['beneficial_owner', 'director'],
      title: 'CFO',
      email: 'amara@example.com',
      country: 'NG',
      ownershipPct: '35',
      isCorporate: false,
      registrationNumber: '',
      owners: [],
    };
    expect(normalizeRestoredKeyPeople([row])).toEqual([row]);
  });
});
