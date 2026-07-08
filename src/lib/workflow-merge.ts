import type { WorkflowConfigPayload } from '../services/api';

/**
 * The prop keys a published flow may override. Exactly the template surface —
 * runtime data (apiKey, devUrl, userId, userData, metadata, deviceHandoff,
 * defaultOpen, callbacks, button attrs) is never flow-controlled and always
 * comes from the consumer's code.
 */
const WORKFLOW_KEYS = [
  'subjectType',
  'business',
  'country',
  'countries',
  'idTypes',
  'enableSelfie',
  'enableDocumentCapture',
  'allowDocumentUpload',
  'enableLiveness',
  'livenessMode',
  'deviceIntelligence',
  'voiceGuidance',
  'showThemeToggle',
  'fullScreen',
  'disableClose',
  'appearance',
  'consent',
  'success',
  'questionnaire',
  'proofOfAddress',
  'nfc',
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
