import { describe, expect, it } from 'vitest';
import {
  grantRole,
  primaryRole,
  quickAddCandidates,
  sectionsFor,
  withoutSection,
} from './key-people-sections';
import type { KeyPersonEntry } from '../context/types';
import type { KeyPersonRole } from '../types/business';

const entry = (over: Partial<KeyPersonEntry>): KeyPersonEntry => ({
  name: 'Bola Owner',
  role: 'shareholder',
  roles: ['shareholder'],
  title: '',
  email: '',
  country: 'NG',
  ownershipPct: '',
  isCorporate: false,
  registrationNumber: '',
  owners: [],
  ...over,
});

const T = 25; // section threshold under test

describe('sectionsFor — membership is derived, never stored', () => {
  it('a declared beneficial owner is a UBO, stake or not', () => {
    const s = sectionsFor(entry({ role: 'beneficial_owner', roles: ['beneficial_owner'] }), T);
    expect(s.has('ubos')).toBe(true);
    expect(s.has('shareholders')).toBe(false);
  });

  it('a stake at the threshold escalates on screen exactly as the server will', () => {
    expect(sectionsFor(entry({ ownershipPct: '25' }), T).has('ubos')).toBe(true);
    expect(sectionsFor(entry({ ownershipPct: '24.9' }), T).has('ubos')).toBe(false);
  });

  it('one stake, one classification: a UBO is not also a plain shareholder', () => {
    const s = sectionsFor(entry({ ownershipPct: '60' }), T);
    expect(s.has('ubos')).toBe(true);
    expect(s.has('shareholders')).toBe(false);
  });

  it('a company is never a UBO, whatever it owns', () => {
    const s = sectionsFor(
      entry({ isCorporate: true, ownershipPct: '80', name: 'Acme Holdings Ltd' }),
      T,
    );
    expect(s.has('ubos')).toBe(false);
    expect(s.has('shareholders')).toBe(true);
  });

  it('a director with a 30% stake wears both hats', () => {
    const s = sectionsFor(
      entry({ role: 'director', roles: ['director'], ownershipPct: '30' }),
      T,
    );
    expect(s.has('ubos')).toBe(true);
    expect(s.has('representatives')).toBe(true);
  });

  it('signatories sit with the representatives', () => {
    expect(
      sectionsFor(entry({ role: 'signatory', roles: ['signatory'] }), T).has('representatives'),
    ).toBe(true);
  });
});

describe('quickAddCandidates', () => {
  it('offers named non-members and never a company as a UBO', () => {
    const rows = [
      entry({ name: 'Jay Effiom', role: 'director', roles: ['director'] }),
      entry({ name: 'Acme Holdings Ltd', isCorporate: true }),
      entry({ name: 'B' }), // too short to be a person yet
    ];
    expect(quickAddCandidates(rows, 'ubos', T)).toEqual([0]);
    // Jay is already a representative; the company is not.
    expect(quickAddCandidates(rows, 'representatives', T)).toEqual([1]);
  });
});

describe('grantRole', () => {
  it('adds the hat and re-derives the headline by precedence', () => {
    const granted = grantRole(entry({ role: 'shareholder', roles: ['shareholder'] }), 'ubos');
    expect(granted.roles).toEqual(['shareholder', 'beneficial_owner']);
    expect(granted.role).toBe('beneficial_owner');
  });

  it('is idempotent', () => {
    const once = grantRole(entry({}), 'representatives');
    expect(grantRole(once, 'representatives').roles).toEqual(once.roles);
  });
});

describe('withoutSection — the card X', () => {
  it('removes the role when that is what membership rested on', () => {
    const row = entry({ role: 'director', roles: ['director', 'shareholder'] });
    const next = withoutSection(row, 'representatives', T)!;
    expect(next.roles).toEqual(['shareholder']);
    expect(next.role).toBe('shareholder');
  });

  it('asks for full removal when a declared stake keeps them in the section', () => {
    // Removing the beneficial_owner role changes nothing at 60% - "take them
    // out of UBOs" can only mean "remove this person".
    const row = entry({
      role: 'beneficial_owner',
      roles: ['beneficial_owner'],
      ownershipPct: '60',
    });
    expect(withoutSection(row, 'ubos', T)).toBeNull();
  });

  it('asks for full removal when it was their last hat', () => {
    expect(withoutSection(entry({}), 'shareholders', T)).toBeNull();
  });
});

describe('primaryRole', () => {
  it('mirrors the server precedence', () => {
    const roles: KeyPersonRole[] = ['shareholder', 'signatory', 'director', 'beneficial_owner'];
    expect(primaryRole(roles)).toBe('beneficial_owner');
    expect(primaryRole(['signatory', 'director'])).toBe('director');
  });
});
