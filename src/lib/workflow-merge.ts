import type { ApplicantWorkflowPayload, WorkflowConfigPayload } from '../services/api';

/**
 * The prop keys a published flow may override. Exactly the template surface —
 * runtime data (apiKey, devUrl, userId, userData, metadata, defaultOpen,
 * callbacks, button attrs) is never flow-controlled and always comes from the
 * consumer's code. `deviceHandoff` IS flow-controlled (a workflow/hosted-link
 * can disable the "continue on your phone" gate); when the flow omits it the
 * consumer prop still wins (undefined flow values are skipped below).
 */
const WORKFLOW_KEYS = [
  'subjectType',
  'business',
  'country',
  'countries',
  'idTypes',
  // Multi-ID (KYC only; deliberately NOT in APPLICANT_LEG_KEYS below — a KYB
  // applicant leg is one person's single check inside a business application).
  'multiId',
  'enableSelfie',
  'enableDocumentCapture',
  'allowDocumentUpload',
  'enableLiveness',
  'livenessMode',
  'flashSequenceLength',
  'deviceIntelligence',
  'deviceHandoff',
  'requireMobileDevice',
  'voiceGuidance',
  'showThemeToggle',
  'progressStyle',
  'fullScreen',
  'disableClose',
  'appearance',
  'consent',
  'success',
  'emailVerification',
  'phoneVerification',
  'questionnaire',
  'proofOfAddress',
  'nfc',
  // Set only on a session a reviewer sent back, never on a published flow.
  'resubmit',
  'assetsBasePath',
] as const;

type WorkflowKey = (typeof WORKFLOW_KEYS)[number];

/**
 * Merge a resolved flow config over the consumer's props — **flow wins** on
 * every key it defines; props fill the gaps (so a dev can still set e.g.
 * `assetsBasePath` when the flow doesn't). `appearance` merges shallowly with
 * flow keys winning per-field, so a flow that only sets `primaryColor` doesn't
 * wipe a prop-supplied `logo`.
 *
 * Pure and side-effect free — unit-tested in flow-merge.test.ts.
 */
export function mergeWorkflowConfig<P extends Record<string, unknown>>(
  flowConfig: WorkflowConfigPayload,
  props: P,
): P {
  const merged: Record<string, unknown> = { ...props };
  const flow = flowConfig as unknown as Record<string, unknown>;

  for (const key of WORKFLOW_KEYS) {
    const value = flow[key as WorkflowKey];
    if (value === undefined) continue;
    if (key === 'appearance') {
      const propAppearance = props['appearance'];
      merged[key] = {
        ...(typeof propAppearance === 'object' && propAppearance !== null ? propAppearance : {}),
        ...(value as Record<string, unknown>),
      };
    } else {
      merged[key] = value;
    }
  }

  // Business (KYB) workflows carry no top-level country — fall back to the
  // registry country so downstream code that expects one (the config context)
  // never sees undefined. The business submission reads business.country anyway.
  if (merged['country'] === undefined && flowConfig.subjectType === 'business' && flowConfig.business) {
    merged['country'] = flowConfig.business.country;
  }

  return merged as P;
}

/**
 * The template keys a mapped APPLICANT workflow (business.applicant.workflowId)
 * overlays onto a KYB mount — the individual capture-leg surface only. KYB
 * publish REJECTS these keys on the business config itself, so the overlay is
 * collision-free by construction. Contact OTPs, the questionnaire, branding and
 * device policy stay the KYB workflow's own (its publish validation refuses a
 * mapped workflow that REQUIRES steps the leg never runs).
 */
const APPLICANT_LEG_KEYS = [
  'country',
  'countries',
  'idTypes',
  'enableSelfie',
  'enableDocumentCapture',
  'allowDocumentUpload',
  'enableLiveness',
  'livenessMode',
  'flashSequenceLength',
  'nfc',
] as const;

/**
 * Overlay a resolved applicant workflow's capture template over an (already
 * workflow-merged) KYB config, and record its id as `applicantWorkflowId` so
 * the applicant's own submission is stamped with it (server-side gates,
 * pricing and decisioning then run the mapped workflow). No-op when nothing
 * was mapped/resolved.
 */
export function overlayApplicantWorkflow<P extends Record<string, unknown>>(
  applicantWorkflow: Pick<ApplicantWorkflowPayload, 'id' | 'config'> | null | undefined,
  merged: P,
): P & { applicantWorkflowId?: string } {
  if (!applicantWorkflow) return merged;
  const out: Record<string, unknown> = { ...merged, applicantWorkflowId: applicantWorkflow.id };
  const flow = applicantWorkflow.config as unknown as Record<string, unknown>;
  for (const key of APPLICANT_LEG_KEYS) {
    if (flow[key] !== undefined) out[key] = flow[key];
  }
  return out as P & { applicantWorkflowId?: string };
}
