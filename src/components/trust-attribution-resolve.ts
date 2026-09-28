import type { SdkTrustAttribution } from '../services/api';

// Which attribution the footer draws, read off the server's branding. Split
// from PoweredBy.tsx (200-line rule); PoweredBy re-exports it.

export type ResolvedTrustAttribution =
  { mode: 'myaza' } | { mode: 'custom'; logo?: string; companyName?: string };

const text = (value: unknown) => (typeof value === 'string' && value.trim()) || undefined;

/**
 * Read defensively: config JSON can come from an older or mixed-version server.
 * Anything that is not `custom` is Myaza; a `custom` with a malformed logo stays
 * custom, because falling back to Myaza would put our mark on a flow the org
 * asked to carry their own. On a dark flow the org's dark-theme version wins
 * when they supplied one, the way the Myaza lockup flips its lettering.
 */
export function resolveTrustAttribution(
  attribution?: SdkTrustAttribution,
  dark = false,
): ResolvedTrustAttribution {
  if (attribution?.mode !== 'custom') return { mode: 'myaza' };
  const raw = attribution as { logo?: unknown; logoDark?: unknown; companyName?: unknown };
  const logo = (dark && text(raw.logoDark)) || text(raw.logo);
  return { mode: 'custom', logo, companyName: text(raw.companyName) };
}
