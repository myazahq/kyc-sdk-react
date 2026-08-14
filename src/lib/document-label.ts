// ─── Document label for the capture chrome ──────────────────────────────────
//
// Port of the Flutter SDK's `shortDocumentLabel` in widgets/document_info_pill.dart.

/**
 * The document's name, short enough to sit in a pill beside a flag.
 *
 * The catalogue label is written for a PICKER, where "International Passport"
 * disambiguates. In the viewfinder it is redundant twice over: the country is
 * already shown by the flag next to it, and nobody is choosing anything at that
 * point — they are aiming a camera.
 *
 * Keyed off the ID TYPE rather than trimmed from the string, so it holds for
 * every country's passport whatever its catalogue label says, including the
 * server-supplied labels that arrive for countries the SDK has no local entry
 * for. Trimming a prefix would work for "International Passport" and quietly
 * fail for the next wording.
 *
 * Hints keep the full label — the same rule as Flutter. A hint is a sentence
 * ("Point the camera at your …"), where the fuller name still reads naturally.
 */
export function shortDocumentLabel(
  idType: string | null | undefined,
  label: string,
): string {
  return idType === 'passport' ? 'Passport' : label;
}
