import { defaultText } from '../i18n/translate';
import type { TextFn } from '../i18n/types';

/**
 * The line under "Supporting documents", from what the flow is actually
 * asking for.
 *
 * It used to be one sentence about keeping documents on file plus a note that
 * required ones are marked with an asterisk — which tells somebody how to read
 * the screen rather than what is being asked of them, and the asterisk carries
 * no information at all when every document is required. The counts are what
 * a person wants: how many they have to produce before they can go on.
 */
export function supportingDocumentsIntro(
  slots: ReadonlyArray<{ required: boolean }>,
  t: TextFn = defaultText,
): string {
  const total = slots.length;
  const required = slots.filter((slot) => slot.required).length;

  // Nothing is compulsory, so the honest line is that the step can be skipped.
  if (required === 0) {
    return total === 1
      ? t('supportingDocuments.intro.optional.one')
      : t('supportingDocuments.intro.optional.many');
  }

  if (required === total) {
    return total === 1
      ? t('supportingDocuments.intro.required.one')
      : t('supportingDocuments.intro.required.all', { total });
  }

  // Mixed, and the only case where the asterisk earns its place on the screen.
  // The noun agrees with the TOTAL, which is always two or more here.
  return t('supportingDocuments.intro.mixed', { required, total });
}
