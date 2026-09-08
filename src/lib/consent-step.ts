// ─── The consent screen switch (`consentStep`) ──────────────────────────────
//
// A workflow can switch the opening consent (welcome) screen off, for an org
// whose own app has already asked: the flow then opens on its first real
// step. Mirrors the server's `WorkflowConfigSchema.consentStep` and the RN /
// Flutter helpers of the same name; keep the default in lockstep.

/** Whether the flow opens on the consent screen. Absent = yes. */
export function hasConsentStep(config: { consentStep?: boolean | null }): boolean {
  return config.consentStep !== false;
}
