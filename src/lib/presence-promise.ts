// Whether the web SDK may tell the applicant an address presence check will
// run after they submit (the intro primer, the success card, the returning
// applicant's completed screen).
//
// Only a phone can collect presence evidence: the mobile SDKs store the pin
// on-device and report against it on later days. The web SDK has neither, so
// the server starts no watch for a browser flow (kyc-core
// presence/reachable.ts), and promising "Address check active" here told
// people something was running that never would (production, 2026-09-28).
// The one exception is the dashboard builder's preview, where the web SDK
// stands in for the mobile screens the org is designing.

export interface PresencePromiseConfig {
  previewMode?: boolean;
  addressCollection?: { presence?: { enabled?: boolean } } | null;
}

export function showsPresencePromise(config: PresencePromiseConfig): boolean {
  return config.previewMode === true && config.addressCollection?.presence?.enabled === true;
}
