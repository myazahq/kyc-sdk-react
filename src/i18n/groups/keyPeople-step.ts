import type { TextEntry } from '../types';

/** The key people step: header, hints, sections, cards and totals. */
export const KEY_PEOPLE_STEP_TEXTS: TextEntry[] = [
  { key: 'keyPeople.title', label: 'Title', default: 'Key people' },
  {
    key: 'keyPeople.description',
    label: 'Description',
    default: "Add the company's directors, shareholders and beneficial owners.",
  },
  {
    key: 'keyPeople.hints.skippable',
    label: 'Hint: you can skip this',
    default:
      'You can skip this if you’re unsure. We’ll identify directors and owners from the official registry. Adding them here speeds up the review.',
    multiline: true,
  },
  {
    key: 'keyPeople.hints.minimumOne',
    label: 'Hint: minimum of one person',
    default: 'List at least {count} person to continue.',
    placeholders: ['count'],
  },
  {
    key: 'keyPeople.hints.minimumMany',
    label: 'Hint: minimum of several people',
    default: 'List at least {count} people to continue.',
    placeholders: ['count'],
  },
  {
    key: 'keyPeople.hints.minimumOneProgress',
    label: 'Hint: minimum of one person, with progress',
    default: 'List at least {count} person to continue ({added} of {count} added).',
    placeholders: ['count', 'added'],
  },
  {
    key: 'keyPeople.hints.minimumManyProgress',
    label: 'Hint: minimum of several people, with progress',
    default: 'List at least {count} people to continue ({added} of {count} added).',
    placeholders: ['count', 'added'],
  },
  { key: 'keyPeople.section.ubos.title', label: 'Beneficial owners: heading', default: 'Beneficial owners' },
  {
    key: 'keyPeople.section.ubos.description',
    label: 'Beneficial owners: description',
    default: 'Individuals who own {threshold}% or more of the company.',
    placeholders: ['threshold'],
  },
  { key: 'keyPeople.section.ubos.add', label: 'Beneficial owners: add button', default: 'Add a beneficial owner' },
  {
    key: 'keyPeople.exemption.label',
    label: 'No beneficial owner: checkbox',
    default:
      'UBOs cannot be identified due to public share structures, complex trusts or nominee arrangements.',
    multiline: true,
  },
  {
    key: 'keyPeople.exemption.note',
    label: 'No beneficial owner: note when ticked',
    default:
      "We will record this with the application; a senior person is still identified through the applicant's own verification.",
    multiline: true,
  },
  { key: 'keyPeople.section.shareholders.title', label: 'Shareholders: heading', default: 'Shareholders' },
  {
    key: 'keyPeople.section.shareholders.description',
    label: 'Shareholders: description',
    default: 'People or companies holding under {threshold}%.',
    placeholders: ['threshold'],
  },
  { key: 'keyPeople.section.shareholders.add', label: 'Shareholders: add button', default: 'Add a shareholder' },
  {
    key: 'keyPeople.section.representatives.title',
    label: 'Representatives: heading',
    default: 'Directors & representatives',
  },
  {
    key: 'keyPeople.section.representatives.description',
    label: 'Representatives: description',
    default: 'People who act on behalf of the company.',
  },
  { key: 'keyPeople.section.representatives.add', label: 'Representatives: add button', default: 'Add a representative' },
  {
    key: 'keyPeople.section.quickAdd',
    label: 'Quick add heading',
    default: 'Quick add from people you already entered',
  },
  { key: 'keyPeople.role.director', label: 'Role: director', default: 'Director' },
  { key: 'keyPeople.role.beneficialOwner', label: 'Role: beneficial owner', default: 'Beneficial owner (UBO)' },
  { key: 'keyPeople.role.signatory', label: 'Role: signatory', default: 'Signatory' },
  { key: 'keyPeople.role.shareholder', label: 'Role: shareholder', default: 'Shareholder' },
  { key: 'keyPeople.card.unnamedCompany', label: 'Card: unnamed company', default: 'Unnamed company' },
  { key: 'keyPeople.card.unnamedPerson', label: 'Card: unnamed person', default: 'Unnamed person' },
  { key: 'keyPeople.card.company', label: 'Card: company tag', default: 'Company' },
  { key: 'keyPeople.card.ownership', label: 'Card: ownership', default: '{pct}% ownership', placeholders: ['pct'] },
  { key: 'keyPeople.card.emailRequired', label: 'Card: email missing', default: 'Email required, tap to add' },
  { key: 'keyPeople.card.incomplete', label: 'Card: incomplete', default: 'Incomplete, tap to finish' },
  {
    key: 'keyPeople.limit',
    label: 'Maximum people reached',
    default: 'You can list up to {count} people here.',
    placeholders: ['count'],
  },
  { key: 'keyPeople.totals.label', label: 'Total ownership label', default: 'Total ownership listed' },
  {
    key: 'keyPeople.totals.overError',
    label: 'Error: total over 100%',
    default: 'Together the percentages can’t exceed 100%, so reduce them by {over}%.',
    multiline: true,
    placeholders: ['over'],
  },
];
