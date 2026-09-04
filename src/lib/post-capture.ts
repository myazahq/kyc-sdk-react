import type { AddressCollectionConfig, KYCStep, PoaDocumentType, ProofOfAddressConfig, QuestionnaireConfig } from '../types/config';
import type { SubjectType, WorkflowBusinessConfig } from '../types/business';
import { hasActiveQuestionnaire } from './questionnaire';
import { isBusinessFlow } from './business';
import { addressFlowOptions, addressFlowSteps, addressVendorsStubbed } from '../steps/address/flow-steps';

/** The slice the address entry/exit resolution reads — the callers pass the
 *  whole config context, so these ride along for free. */
interface AddressFlowFacts {
  addressCollection?: AddressCollectionConfig;
  serverConfig?: {
    addressSearch?: boolean;
    googleMapsBrowserKey?: string | null;
    mapsFrameUrl?: string | null;
    environment?: 'DEVELOPMENT' | 'SANDBOX' | 'PRODUCTION';
  } | null;
  previewMode?: boolean;
  subjectType?: SubjectType;
  business?: WorkflowBusinessConfig;
}

/** The address flow's steps for THIS mount (KYB = the single premises step). */
function flowStepsFor(config: AddressFlowFacts): KYCStep[] {
  if (isBusinessFlow(config)) return ['address-collection'];
  return addressFlowSteps(
    addressFlowOptions({
      photo: config.addressCollection?.photo,
      streetView: config.addressCollection?.streetView,
      serverSearch: Boolean(config.serverConfig?.addressSearch),
      previewMode: addressVendorsStubbed({
        previewMode: config.previewMode,
        environment: config.serverConfig?.environment,
      }),
      hasGoogleKey: Boolean(config.serverConfig?.googleMapsBrowserKey),
      hasStreetViewFrame: Boolean(config.serverConfig?.mapsFrameUrl),
    }),
  );
}

/** Entering the address flow FORWARDS lands on its first step (search when a
 *  backend is on) — routing straight to the pin step skipped search entirely,
 *  which shipped. */
export function addressEntryStep(config: AddressFlowFacts): KYCStep {
  return flowStepsFor(config)[0]!;
}

/** Backing INTO the address flow (from the questionnaire) lands on its LAST
 *  step — the review — not the pin. */
export function addressReturnStep(config: AddressFlowFacts): KYCStep {
  const steps = flowStepsFor(config);
  return steps[steps.length - 1]!;
}

/** Whether the Proof of Address step is part of the flow. */
export function hasProofOfAddressStep(poa: ProofOfAddressConfig | undefined | null): boolean {
  return poa?.enabled === true;
}

export const POA_ALL_KINDS = ['utility_bill', 'bank_statement', 'tenancy_agreement', 'other'] as const;

/**
 * The document kinds the PoA step offers for a given country: the per-country
 * override when the workflow sets one (the builder matrix's row cells), else
 * the global `documentTypes`, else every kind. Re-derived as the effective
 * country changes (the address scope's declared-country pick included).
 */
export function poaOfferedKinds(
  poa: ProofOfAddressConfig | undefined | null,
  country: string | undefined | null,
): PoaDocumentType[] {
  const override = country ? poa?.countryDocuments?.[country.toUpperCase()] : undefined;
  if (override && override.length > 0) return override;
  if (poa?.documentTypes && poa.documentTypes.length > 0) return poa.documentTypes;
  return [...POA_ALL_KINDS];
}

/**
 * Whether the PoA accepted-country list admits the flow's country. Gates the
 * STEP on full flows (an org that accepts address documents from three
 * markets should not collect them from a fourth); the ADDRESS SCOPE is exempt
 * by the caller — there the step hosts the declared-country picker, which
 * already offers only the accepted list. Unset/empty = every country.
 */
export function poaCountryAccepted(
  poa: ProofOfAddressConfig | undefined | null,
  country: string | undefined | null,
): boolean {
  const accepted = poa?.countries;
  if (!accepted?.length) return true;
  if (!country) return true;
  const code = country.toUpperCase();
  return accepted.some((c) => c.toUpperCase() === code);
}

/** Whether the Address Intelligence capture step is part of the flow. */
export function hasAddressCollectionStep(
  address: AddressCollectionConfig | undefined | null,
): boolean {
  return address?.enabled === true;
}

/**
 * The step that follows capture/liveness: Proof of Address (when enabled),
 * then the questionnaire (when active), then submission. Call sites map a
 * 'submitted' return to their own submit mechanism (SET_STEP vs
 * SUBMIT_VERIFICATION).
 *
 * In a BUSINESS flow the capture leg is the applicant's own verification, and
 * it is the LAST thing in the application: PoA never runs on KYB, and the
 * questionnaire was already asked back in the company section (before key
 * people). Returning 'questionnaire' here made the reordered flow a loop —
 * questionnaire → key people → applicant capture → questionnaire again.
 */
export function stepAfterCapture(
  config: {
    proofOfAddress?: ProofOfAddressConfig;
    questionnaire?: QuestionnaireConfig;
  } & AddressFlowFacts,
): Extract<KYCStep, 'proof-of-address' | 'address-search' | 'address-collection' | 'questionnaire' | 'submitted'> {
  if (isBusinessFlow(config)) return 'submitted';
  if (hasProofOfAddressStep(config.proofOfAddress)) return 'proof-of-address';
  return stepAfterProofOfAddress(config);
}

/**
 * The step that follows Proof of Address (or capture, when PoA is off):
 * Address Intelligence (when enabled), then the questionnaire, then
 * submission. The PoA step's Continue and the questionnaire's Back both
 * resolve through here so the chain has one owner.
 */
export function stepAfterProofOfAddress(
  config: { questionnaire?: QuestionnaireConfig } & AddressFlowFacts,
): Extract<KYCStep, 'address-search' | 'address-collection' | 'questionnaire' | 'submitted'> {
  if (hasAddressCollectionStep(config.addressCollection)) {
    return addressEntryStep(config) as Extract<KYCStep, 'address-search' | 'address-collection'>;
  }
  if (hasActiveQuestionnaire(config.questionnaire)) return 'questionnaire';
  return 'submitted';
}
