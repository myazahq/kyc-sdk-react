import type { SupportingDocumentsConfig } from '../types/config';
import { idComposite, resolveSupportingDocuments, verifiedIdsFor } from './supporting-documents';

// Builder preview only. Not part of the four-way resolution mirror (server +
// web/RN/Flutter): there is no builder preview on the mobile SDKs, and nothing
// here decides what a real applicant is asked for.

/** A frame the preview can show: one country, one ID, as an applicant would. */
export interface PreviewSelection {
  country: string;
  idType: string;
}

function parseComposite(value: string): PreviewSelection | null {
  const [country, ...rest] = value.trim().split('/');
  const idType = rest.join('/').trim();
  return country && idType ? { country: country.toUpperCase(), idType } : null;
}

/**
 * What to select so the Supporting documents preview shows the author's own
 * documents.
 *
 * A scoped document ("the slip that only exists because somebody used their
 * NIN") resolves against the ID the applicant verified with, and on a
 * multi-region flow against the COUNTRY they picked too. In the preview nobody
 * has picked either, so the flow sits on its primary country with no ID and a
 * scoped document resolves to nothing — the author reads an empty step as a
 * broken one. That is not a corner case: a flow offering every African country
 * has some other country first alphabetically, so a document scoped to NG/nin
 * is invisible by default.
 *
 * The search is over the SCOPES THEMSELVES rather than every country times
 * every ID: the documents say which frames they appear in, and the first one
 * the flow actually offers is a frame somebody could really be shown. Returns
 * null when the current selection already shows as many, so nothing is
 * seeded for a document asked of everyone.
 */
export function previewSelectionForSupportingDocuments(input: {
  config: SupportingDocumentsConfig | undefined | null;
  /** The flow's effective country before anybody picks one. */
  country: string | null | undefined;
  /** Whether this flow offers that pair — countries[] and their allowlists. */
  isOffered: (country: string, idType: string) => boolean;
  selected?: { country?: string | null; idType?: string | null };
}): PreviewSelection | null {
  const { config, country, isOffered, selected } = input;
  if (!config?.enabled) return null;

  const count = (pick: PreviewSelection | null) =>
    resolveSupportingDocuments(
      config,
      pick ? [idComposite(pick.country, pick.idType)] : verifiedIdsFor({ country, idType: null }),
    ).length;

  // With nothing picked the step still shows every unscoped document, so that
  // is the bar a seed has to beat.
  const current =
    selected?.country && selected.idType
      ? count({ country: selected.country, idType: selected.idType })
      : count(null);

  let best: PreviewSelection | null = null;
  let bestCount = current;
  const seen = new Set<string>();
  for (const entry of config.types ?? []) {
    for (const composite of entry.idTypes ?? []) {
      if (seen.has(composite)) continue;
      seen.add(composite);
      const pick = parseComposite(composite);
      if (!pick || !isOffered(pick.country, pick.idType)) continue;
      const n = count(pick);
      if (n > bestCount) {
        best = pick;
        bestCount = n;
      }
    }
  }
  return best;
}
