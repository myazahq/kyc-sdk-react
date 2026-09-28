import type { TextGroup } from '../types';
import { KEY_PEOPLE_STEP_TEXTS } from './keyPeople-step';
import { KEY_PEOPLE_FORM_TEXTS } from './keyPeople-form';
import { KEY_PEOPLE_AWAIT_TEXTS } from './keyPeople-await';

/** The key people step, the add/edit person sheet, and the list of people still to verify. */
export const KEY_PEOPLE_TEXTS: TextGroup = {
  id: 'keyPeople',
  title: 'Key People',
  entries: [...KEY_PEOPLE_STEP_TEXTS, ...KEY_PEOPLE_FORM_TEXTS, ...KEY_PEOPLE_AWAIT_TEXTS],
};
