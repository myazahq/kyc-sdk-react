import { CUSTOMISABLE_TEXTS } from './customisable';
import { BASE_LANGUAGE } from './translate';
import type { TextAvailability } from './types';

/** One customisable text as the shared vector file records it. */
export interface CustomisableTextVector {
  key: string;
  group: string;
  default: string;
  placeholders?: string[];
  configPath?: string[];
  availability: TextAvailability;
}

/**
 * The shared contract for every SDK: which keys a workflow's texts may use,
 * where each appears, and the older config field that wins over it. Mobile
 * SDKs keep their own default wording; the key and its meaning are what match.
 */
export function customisableTextsVectors(): {
  baseLanguage: string;
  resolution: string[];
  texts: CustomisableTextVector[];
} {
  return {
    baseLanguage: BASE_LANGUAGE,
    resolution: [
      "the workflow's text in the applicant's language, when that is not the base language",
      'the older config field named by configPath',
      "the workflow's text in the base language",
      "the SDK's own default",
    ],
    texts: CUSTOMISABLE_TEXTS.flatMap((group) =>
      group.entries.map((entry) => ({
        key: entry.key,
        group: group.id,
        default: entry.default,
        ...(entry.placeholders?.length ? { placeholders: entry.placeholders } : {}),
        ...(entry.configPath ? { configPath: entry.configPath } : {}),
        availability: entry.availability ?? {},
      })),
    ),
  };
}
