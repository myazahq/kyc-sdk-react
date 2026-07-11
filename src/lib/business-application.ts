// ---------------------------------------------------------------------------
// Business (KYB) APPLICATION helpers — the steps a KYB workflow can add beyond
// the registration details: key-people collection, supporting documents, and
// applicant identity verification. Single source of truth for which steps are
// in the flow and how they sequence; the step order, the modal's progress bar,
// each step's navigation, and the submission payload all read these.
// ---------------------------------------------------------------------------

import type {
  ApplicantRole,
  BusinessDocumentKey,
  KeyPersonRole,
  WorkflowBusinessConfig,
} from '../types/business';
import type { KYCStep, QuestionnaireConfig } from '../types/config';
import type { KeyPersonEntry } from '../context/types';
import { hasActiveQuestionnaire } from './questionnaire';
import { isValidContactEmail } from './business';

/** Default display labels per document key (server contract). */
export const BUSINESS_DOCUMENT_LABELS: Record<BusinessDocumentKey, string> = {
  incorporation_certificate: 'Certificate of incorporation',
  memart: 'MEMART / articles of association',
  proof_of_address: 'Proof of business address',
  tax_document: 'Tax document',
  regulatory_license: 'Regulatory license',
  board_resolution: 'Board resolution',
  other: 'Other document',
};

export const KEY_PERSON_ROLE_LABELS: Record<KeyPersonRole, string> = {
  director: 'Director',
  beneficial_owner: 'Beneficial owner (UBO)',
  signatory: 'Signatory',
  shareholder: 'Shareholder',
};

export const APPLICANT_ROLE_LABELS: Record<ApplicantRole, string> = {
  ...KEY_PERSON_ROLE_LABELS,
  authorized_representative: 'Authorized representative',
};

/** UI cap on applicant-entered key-people rows (server accepts ≤20). */
export const MAX_KEY_PEOPLE_ROWS = 10;

// ---------------------------------------------------------------------------
// Step gates
// ---------------------------------------------------------------------------

/** Whether the flow collects key people from the applicant. */
export function hasKeyPeopleCollection(business: WorkflowBusinessConfig | undefined): boolean {
  return business?.keyPeople?.enabled === true && business.keyPeople.collect === true;
}

/** Whether the flow collects supporting business documents. */
export function hasBusinessDocumentsStep(business: WorkflowBusinessConfig | undefined): boolean {
  return business?.documents?.enabled === true;
}

/** Whether the applicant verifies their own identity in-flow. */
export function hasApplicantVerification(business: WorkflowBusinessConfig | undefined): boolean {
  return business?.applicant?.verification === true;
}

export interface ResolvedBusinessDocumentType {
  key: BusinessDocumentKey;
  label: string;
  required: boolean;
}

/**
 * The document slots the flow renders. Enabled with absent/empty `types`
 * defaults to just a required incorporation certificate (server contract).
 */
export function resolveBusinessDocumentTypes(
  business: WorkflowBusinessConfig | undefined,
): ResolvedBusinessDocumentType[] {
  if (!hasBusinessDocumentsStep(business)) return [];
  const types = business?.documents?.types;
  if (!types || types.length === 0) {
    return [
      {
        key: 'incorporation_certificate',
        label: BUSINESS_DOCUMENT_LABELS.incorporation_certificate,
        required: true,
      },
    ];
  }
  return types.map((t) => ({
    key: t.key,
    label: t.label ?? BUSINESS_DOCUMENT_LABELS[t.key] ?? t.key,
    required: t.required === true,
  }));
}

// ---------------------------------------------------------------------------
// Step sequencing — the business application section between consent and the
// questionnaire/submission
// ---------------------------------------------------------------------------

export type BusinessSectionStep =
  | 'business-details'
  | 'business-key-people'
  | 'business-documents'
  | 'applicant-role';

/** The ordered business-application steps this workflow configures. */
export function businessSectionSteps(
  business: WorkflowBusinessConfig | undefined,
): BusinessSectionStep[] {
  const steps: BusinessSectionStep[] = ['business-details'];
  if (hasKeyPeopleCollection(business)) steps.push('business-key-people');
  if (hasBusinessDocumentsStep(business)) steps.push('business-documents');
  if (hasApplicantVerification(business)) steps.push('applicant-role');
  return steps;
}

/**
 * The step after `current` in the business flow. `applicant-role` hands off to
 * the ordinary individual capture leg ('id-type'); after the last section step
 * the flow continues to the questionnaire (when active) or submission. Callers
 * map a 'submitted' return to `SUBMIT_VERIFICATION` (existing convention).
 */
export function nextBusinessStep(
  current: BusinessSectionStep,
  config: { business?: WorkflowBusinessConfig; questionnaire?: QuestionnaireConfig },
): KYCStep {
  if (current === 'applicant-role') return 'id-type';
  const order = businessSectionSteps(config.business);
  const next = order[order.indexOf(current) + 1];
  if (next) return next;
  return hasActiveQuestionnaire(config.questionnaire) ? 'questionnaire' : 'submitted';
}

/** The step before `current` in the business application section. */
export function prevBusinessStep(
  current: BusinessSectionStep,
  business: WorkflowBusinessConfig | undefined,
): KYCStep {
  const order = businessSectionSteps(business);
  const idx = order.indexOf(current);
  return idx > 0 ? order[idx - 1]! : 'consent';
}

/** The last business-application step (what the questionnaire's Back returns
 *  to when the workflow has no applicant capture leg). */
export function lastBusinessSectionStep(
  business: WorkflowBusinessConfig | undefined,
): BusinessSectionStep {
  const order = businessSectionSteps(business);
  return order[order.length - 1]!;
}

// ---------------------------------------------------------------------------
// Key-people rows — validation + submit payload
// ---------------------------------------------------------------------------

const KEY_PERSON_ROLES: readonly KeyPersonRole[] = [
  'director',
  'beneficial_owner',
  'signatory',
  'shareholder',
];

/** Row validity: name ≥2 chars + known role; email/ownership validated when typed. */
export function isKeyPersonRowValid(row: KeyPersonEntry): boolean {
  if (row.name.trim().length < 2) return false;
  if (!KEY_PERSON_ROLES.includes(row.role)) return false;
  if (row.email.trim() !== '' && !isValidContactEmail(row.email.trim())) return false;
  if (row.ownershipPct.trim() !== '') {
    const pct = Number(row.ownershipPct);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return false;
  }
  return true;
}

/** Map valid rows into the verify payload shape (capped at the server's 20). */
export function keyPeoplePayload(
  rows: KeyPersonEntry[],
): Array<{ name: string; role: KeyPersonRole; email?: string; country?: string; ownershipPct?: number }> {
  return rows
    .filter(isKeyPersonRowValid)
    .slice(0, 20)
    .map((row) => ({
      name: row.name.trim(),
      role: row.role,
      ...(row.email.trim() !== '' ? { email: row.email.trim() } : {}),
      ...(row.country.trim() !== '' ? { country: row.country.trim().toUpperCase() } : {}),
      ...(row.ownershipPct.trim() !== '' ? { ownershipPct: Number(row.ownershipPct) } : {}),
    }));
}

/** Minimum applicant-listed people the workflow demands (0 = skippable). */
export function keyPeopleMinEntries(
  business: import('../types/business').WorkflowBusinessConfig | undefined,
): number {
  const kp = business?.keyPeople;
  if (!kp?.enabled || !kp.collect) return 0;
  return kp.minEntries ?? 0;
}

/** Split a typed full name into userData first/last (best-effort). */
export function splitFullName(
  name: string,
): { firstName?: string; lastName?: string } | undefined {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const [firstName, ...rest] = trimmed.split(/\s+/);
  return { firstName, ...(rest.length > 0 ? { lastName: rest.join(' ') } : {}) };
}
