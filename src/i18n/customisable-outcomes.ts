import type { TextAvailability } from './types';
import {
  BUSINESS,
  EVERYWHERE,
  FACE_CHECK,
  FACE_ENROLMENT,
  FULL_IDENTITY,
  IDENTITY,
  all,
} from './customisable-where';

/** The customisable texts for the outcome, handoff and shared button screens. */
export const OUTCOME_TEXTS: Record<string, TextAvailability> = {
  // Outcomes. The older success and face-check fields cover every variant they name.
  ...all(
    [
      'result.submitting.title',
      'result.submitting.description',
      'result.success.title',
      'result.success.redirectLabel',
      'result.success.closeTabNote',
      'result.completed.approved.title',
      'result.completed.declined.title',
      'result.completed.actionNeeded.title',
      'result.completed.actionNeeded.description',
    ],
    EVERYWHERE,
  ),
  ...all(['result.success.description.individual', 'result.completed.approved.description.individual', 'result.completed.declined.description.individual'], FULL_IDENTITY),
  ...all(['result.success.description.business', 'result.completed.approved.description.business', 'result.completed.declined.description.business'], BUSINESS),
  ...all(['result.completed.approved.description.address', 'result.completed.declined.description.address'], { scopes: ['address'] }),
  ...all(['result.completed.approved.description.questionnaire', 'result.completed.declined.description.questionnaire'], { scopes: ['questionnaire'] }),
  ...all(['result.completed.approved.description.contact', 'result.completed.declined.description.contact'], { scopes: ['contact'] }),
  ...all(
    [
      'result.faceCheck.checking.title',
      'result.faceCheck.checking.description',
      'result.faceCheck.sending.title',
      'result.faceCheck.sending.description',
      'result.faceCheck.verified.title',
      'result.faceCheck.verified.description',
      'result.faceCheck.declined.title',
      'result.faceCheck.declined.description',
      'result.faceCheck.inReview.title',
      'result.faceCheck.inReview.description',
      'result.faceCheck.submitted.title',
      'result.faceCheck.submitted.description',
      'result.faceCheck.timeout.title',
      'result.faceCheck.timeout.description',
    ],
    FACE_CHECK,
  ),
  ...all(
    [
      'result.faceEnrolment.saving.title',
      'result.faceEnrolment.saving.description',
      'result.completed.approved.title.faceEnrolment',
      'result.completed.approved.description.faceEnrolment',
      'result.completed.declined.description.faceEnrolment',
    ],
    FACE_ENROLMENT,
  ),

  ...all(
    [
      'handoff.gate.title',
      'handoff.gate.description',
      'handoff.gate.description.noCamera',
      'handoff.codeLabel',
      'handoff.copyLink',
      'handoff.continueHere',
      'handoff.completed.title',
      'handoff.completed.description',
      'handoff.sheet.trigger',
      'handoff.sheet.title',
      'handoff.sheet.description',
      'handoff.sheet.stayButton',
    ],
    { step: 'handoff' },
  ),
  ...all(['handoff.gate.description.mobileOnly', 'handoff.mobileOnly.title', 'handoff.mobileOnly.description'], EVERYWHERE),

  ...all(['common.continue', 'common.back', 'common.done', 'common.skip', 'common.retake'], EVERYWHERE),
  ...all(['common.continueAnyway'], IDENTITY),
};
