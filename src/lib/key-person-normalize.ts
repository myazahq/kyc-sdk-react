// Coercing RESTORED key-people rows back into the shape the step can read.
//
// A resumed attempt hydrates `businessApplication.keyPeople` from a snapshot
// the server stored — written by WHATEVER SDK build saved it. The row shape
// has grown over this branch's life (`roles`, `title`, `owners`,
// `registrationNumber` all landed later), so a snapshot from an older build
// is missing fields the current cards call `.trim()` on, and the step crashed
// on render (`isKeyPersonRowValid`). The rule for restores is "a partial or
// pre-redesign snapshot degrades to restoring LESS, never to breaking the
// flow" — so every field is coerced to its declared type here, and a value we
// cannot read restores as empty for the applicant to re-supply.
import { primaryRole } from './key-people-sections';
import type { KeyPersonEntry, KeyPersonOwnerEntry } from '../context/types';
import type { KeyPersonRole } from '../types/business';

const VALID_ROLES: readonly KeyPersonRole[] = [
  'director',
  'beneficial_owner',
  'signatory',
  'shareholder',
];

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Ownership as typed — tolerating a build that stored it as a number. */
const pct = (v: unknown): string =>
  typeof v === 'number' && Number.isFinite(v) ? String(v) : str(v);

const isRole = (v: unknown): v is KeyPersonRole => VALID_ROLES.includes(v as KeyPersonRole);

function normalizeOwner(v: unknown): KeyPersonOwnerEntry | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  return { name: str(o.name), ownershipPct: pct(o.ownershipPct), email: str(o.email), country: str(o.country) };
}

/**
 * Restored rows, every field coerced. Non-object entries are dropped; a row
 * with unreadable values comes back as a blank-ish row rather than a crash
 * (blank rows are already tolerated by the step). Returns null when the
 * snapshot carried no usable array, so the caller keeps current state.
 */
export function normalizeRestoredKeyPeople(value: unknown): KeyPersonEntry[] | null {
  if (!Array.isArray(value)) return null;
  const rows: KeyPersonEntry[] = [];
  for (const v of value) {
    if (typeof v !== 'object' || v === null) continue;
    const r = v as Record<string, unknown>;
    const roles = (Array.isArray(r.roles) ? r.roles.filter(isRole) : []) as KeyPersonRole[];
    const finalRoles = roles.length > 0 ? roles : [isRole(r.role) ? r.role : 'director'];
    rows.push({
      name: str(r.name),
      // The invariant on the type: `role` is always `roles`' strongest member.
      role: primaryRole(finalRoles),
      roles: finalRoles,
      title: str(r.title),
      email: str(r.email),
      country: str(r.country),
      ownershipPct: pct(r.ownershipPct),
      isCorporate: r.isCorporate === true,
      registrationNumber: str(r.registrationNumber),
      owners: Array.isArray(r.owners)
        ? r.owners.map(normalizeOwner).filter((o): o is KeyPersonOwnerEntry => o !== null)
        : [],
    });
  }
  return rows;
}
