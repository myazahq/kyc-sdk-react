import { COMMON_TEXTS } from './groups/common';
import { WELCOME_TEXTS } from './groups/welcome';
import { CONTACT_TEXTS } from './groups/contact';
import { SELECT_DOCUMENT_TEXTS } from './groups/selectDocument';
import { PRIMER_TEXTS } from './groups/primer';
import { UPLOAD_DOCUMENT_TEXTS } from './groups/uploadDocument';
import { NFC_TEXTS } from './groups/nfc';
import { PRESENCE_TEXTS } from './groups/presence';
import { ADDRESS_TEXTS } from './groups/address';
import { PROOF_OF_ADDRESS_TEXTS } from './groups/proofOfAddress';
import { SUPPORTING_DOCUMENTS_TEXTS } from './groups/supportingDocuments';
import { BUSINESS_TEXTS } from './groups/business';
import { KEY_PEOPLE_TEXTS } from './groups/keyPeople';
import { QUESTIONNAIRE_TEXTS } from './groups/questionnaire';
import { RESULT_TEXTS } from './groups/result';
import { HANDOFF_TEXTS } from './groups/handoff';
import { GENERAL_TEXTS } from './groups/general';
import type { TextGroup } from './types';

/**
 * Every text group, in the order the dashboard editor lists them (roughly the
 * order an applicant meets the screens). Each group lives in its own file under
 * ./groups; add a group there and list it here.
 */
export const TEXT_GROUPS: TextGroup[] = [
  WELCOME_TEXTS,
  CONTACT_TEXTS,
  SELECT_DOCUMENT_TEXTS,
  PRIMER_TEXTS,
  UPLOAD_DOCUMENT_TEXTS,
  NFC_TEXTS,
  PRESENCE_TEXTS,
  ADDRESS_TEXTS,
  PROOF_OF_ADDRESS_TEXTS,
  SUPPORTING_DOCUMENTS_TEXTS,
  BUSINESS_TEXTS,
  KEY_PEOPLE_TEXTS,
  QUESTIONNAIRE_TEXTS,
  RESULT_TEXTS,
  HANDOFF_TEXTS,
  GENERAL_TEXTS,
  COMMON_TEXTS,
];

/** Key to English default, built once from the groups. */
export const DEFAULT_TEXTS: Record<string, string> = Object.fromEntries(
  TEXT_GROUPS.flatMap((group) => group.entries.map((entry) => [entry.key, entry.default])),
);
