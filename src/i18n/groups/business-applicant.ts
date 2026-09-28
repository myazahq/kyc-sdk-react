import type { TextEntry } from '../types';

/** The applicant's own role step, before they verify their identity. */
export const BUSINESS_APPLICANT_TEXTS: TextEntry[] = [
  { key: 'business.applicant.title', label: 'Applicant: title', default: 'Now verify your own identity' },
  {
    key: 'business.applicant.description',
    label: 'Applicant: description',
    default: 'Tell us your role at the business, then verify your identity with a government-issued ID.',
    multiline: true,
  },
  {
    key: 'business.applicant.notice',
    label: 'Applicant: why this is asked',
    default:
      'Regulations require the person submitting a business application to verify their own identity. This only takes a minute.',
    multiline: true,
  },
  { key: 'business.applicant.whoLabel', label: 'Applicant: are you listed question', default: 'Are you one of the people you listed?' },
  { key: 'business.applicant.ownership', label: 'Applicant: ownership', default: '{pct}% ownership', placeholders: ['pct'] },
  { key: 'business.applicant.notListed', label: 'Applicant: not listed option', default: "I'm not one of these people" },
  {
    key: 'business.applicant.selfNote',
    label: 'Applicant: picked themselves note',
    default: "You'll verify your identity at the end of this form, so no separate invite link is needed for you.",
    multiline: true,
  },
  { key: 'business.applicant.roleLabel', label: 'Applicant: role label', default: 'Your role at the business' },
  { key: 'business.applicant.rolePlaceholder', label: 'Applicant: role placeholder', default: 'Select your role' },
  {
    key: 'business.applicant.role.authorizedRepresentative',
    label: 'Role: authorised representative',
    default: 'Authorized representative',
  },
  { key: 'business.applicant.nameLabel', label: 'Applicant: name label', default: 'Full name' },
  { key: 'business.applicant.namePlaceholder', label: 'Applicant: name placeholder', default: 'Enter your full name' },
];
