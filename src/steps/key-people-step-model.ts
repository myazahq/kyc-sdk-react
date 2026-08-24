import type { WorkflowBusinessConfig } from '../types/business';
import { SECTION_ROLE, type KeyPeopleSection } from '../lib/key-people-sections';
import type { KeyPersonEntry } from '../context/types';

/**
 * The register's default beneficial-ownership line, when the workflow does
 * not set its own. Mirrors the server's `uboThresholdFor`: 25 is the
 * FATF/EU/FinCEN indicative figure; Nigeria's CAMA files significant control
 * from a lower bar, so NG defaults to 10. Keep the two in lockstep.
 */
export function defaultUboThreshold(country?: string | null): number {
  return (country ?? '').toUpperCase() === 'NG' ? 10 : 25;
}

export interface KeyPeopleSectionDef {
  key: KeyPeopleSection;
  title: string;
  description: string;
  addLabel: string;
}

/** "25" not "25.0" — the threshold is a whole number in practice. */
const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : String(n));

/**
 * Which sections the step shows, with their plain-language definitions. The
 * definitions carry the REAL threshold (workflow override or the register's
 * default) — a printed band the server does not enforce would be a lie the
 * applicant plans around. Scope follows the workflow's `keyPeople.roles`:
 * a flow that only wants UBOs only shows that section.
 */
export function keyPeopleSectionList(
  business: WorkflowBusinessConfig | undefined,
  threshold: number,
): KeyPeopleSectionDef[] {
  const scoped = business?.keyPeople?.roles;
  const inScope = (roles: string[]): boolean =>
    !scoped || scoped.length === 0 || roles.some((r) => scoped.includes(r as never));

  const t = fmt(threshold);
  const out: KeyPeopleSectionDef[] = [];
  if (inScope(['beneficial_owner'])) {
    out.push({
      key: 'ubos',
      title: 'Beneficial owners',
      description: `Individuals who own ${t}% or more of the company.`,
      addLabel: 'Add a beneficial owner',
    });
  }
  if (inScope(['shareholder'])) {
    out.push({
      key: 'shareholders',
      title: 'Shareholders',
      description: `People or companies holding under ${t}%.`,
      addLabel: 'Add a shareholder',
    });
  }
  if (inScope(['director', 'signatory'])) {
    out.push({
      key: 'representatives',
      title: 'Directors & representatives',
      description: 'People who act on behalf of the company.',
      addLabel: 'Add a representative',
    });
  }
  return out;
}

/** A fresh entry, wearing the hat of the section whose add-tile was tapped. */
export function emptyKeyPersonEntry(
  section: KeyPeopleSection,
  country: string,
): KeyPersonEntry {
  return {
    name: '',
    role: SECTION_ROLE[section],
    roles: [SECTION_ROLE[section]],
    title: '',
    email: '',
    country,
    ownershipPct: '',
    isCorporate: false,
    registrationNumber: '',
    owners: [],
  };
}
