import type { TextEntry } from '../types';

const WAITING_TITLE = ['biometric', 'copy', 'waiting', 'title'];
const WAITING_DESCRIPTION = ['biometric', 'copy', 'waiting', 'description'];

/** The face check's loading screen and its verdict screens. */
export const RESULT_BIOMETRIC_TEXTS: TextEntry[] = [
  {
    key: 'result.faceCheck.checking.title',
    label: 'Face check waiting: title',
    default: "Checking it's you",
    configPath: WAITING_TITLE,
  },
  {
    key: 'result.faceCheck.checking.description',
    label: 'Face check waiting: description',
    default: 'Matching your selfie against the photo on record. This usually takes a few seconds.',
    multiline: true,
    configPath: WAITING_DESCRIPTION,
  },
  {
    key: 'result.faceCheck.sending.title',
    label: 'Face check sending: title',
    default: 'Sending your face check',
    configPath: WAITING_TITLE,
  },
  {
    key: 'result.faceCheck.sending.description',
    label: 'Face check sending: description',
    default: 'This only takes a moment.',
    configPath: WAITING_DESCRIPTION,
  },
  {
    key: 'result.faceEnrolment.saving.title',
    label: 'Face enrolment saving: title',
    default: 'Saving your selfie',
    configPath: WAITING_TITLE,
  },
  {
    key: 'result.faceEnrolment.saving.description',
    label: 'Face enrolment saving: description',
    default: 'It becomes the reference for your future face checks.',
    configPath: WAITING_DESCRIPTION,
  },
  {
    key: 'result.faceCheck.verified.title',
    label: 'Face check verified: title',
    default: "You're verified",
    configPath: ['biometric', 'copy', 'verified', 'title'],
  },
  {
    key: 'result.faceCheck.verified.description',
    label: 'Face check verified: description',
    default: 'Your face matched the photo on record.',
    configPath: ['biometric', 'copy', 'verified', 'description'],
  },
  {
    key: 'result.faceCheck.declined.title',
    label: 'Face check declined: title',
    default: "We couldn't confirm it's you",
    configPath: ['biometric', 'copy', 'declined', 'title'],
  },
  {
    key: 'result.faceCheck.declined.description',
    label: 'Face check declined: description',
    default: "Your face didn't match the photo on record.",
    configPath: ['biometric', 'copy', 'declined', 'description'],
  },
  { key: 'result.faceCheck.inReview.title', label: 'Face check in review: title', default: 'Under review' },
  {
    key: 'result.faceCheck.inReview.description',
    label: 'Face check in review: description',
    default: "A reviewer will take a look. You'll be notified of the outcome.",
    multiline: true,
  },
  { key: 'result.faceCheck.error.title', label: 'Face check error: title', default: 'Something went wrong' },
  {
    key: 'result.faceCheck.error.description',
    label: 'Face check error: description',
    default: "We couldn't complete your check. Please try again in a moment.",
    multiline: true,
  },
  { key: 'result.faceCheck.submitted.title', label: 'Face check submitted: title', default: 'Check submitted' },
  {
    key: 'result.faceCheck.submitted.description',
    label: 'Face check submitted: description',
    default: "You'll be notified of the result.",
  },
  { key: 'result.faceCheck.timeout.title', label: 'Face check taking long: title', default: 'Still checking' },
  {
    key: 'result.faceCheck.timeout.description',
    label: 'Face check taking long: description',
    default: "This is taking longer than usual. You'll be notified as soon as it's done.",
    multiline: true,
  },
];
