// ---------------------------------------------------------------------------
// Business (KYB) workflow types
//
// LIVE business verification is WORKFLOW-REQUIRED: the server only accepts a
// business submission with a published KYB workflow (workflowId or hosted
// link). `subjectType`/`business` also exist as public props for the dashboard
// builder's live preview (`previewMode`, where all writes are mocked).
// ---------------------------------------------------------------------------

/** What a workflow verifies. Absent = 'individual' (classic KYC). */
export type SubjectType = 'individual' | 'business';

/**
 * A KYB workflow's business configuration block. Business verification is a
 * registry lookup — no ID types, no capture — and the block carries its own
 * registry countries (any provider-supported ISO-2 codes, NOT limited to the
 * individual-KYC catalogue).
 */
export interface WorkflowBusinessConfig {
  /** ISO-2 PRIMARY registry country — the picker's default/pre-selected value. */
  country: string;
  /**
   * Multi-registry: every country the visitor may pick from. Published
   * workflows always carry an explicit list (the server materializes the
   * "all supported countries" mode at publish); absent = just the primary.
   */
  countries?: string[];
  /** Builder marker for "all supported countries" (materialized at publish). */
  allCountries?: boolean;
  /**
   * Offered verification products (keys from the server's business-products
   * catalog, e.g. 'business', 'business-tax'). Absent = just 'business'.
   * The effective offering narrows per picked country (TIN is NG-only).
   */
  products?: string[];
  /** Require the visitor to also type the registered business name. */
  requireRegistrationName?: boolean;
}
