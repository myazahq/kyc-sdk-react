import type { TextGroup } from '../types';
import { RESULT_SUBMIT_TEXTS } from './result-submit';
import { RESULT_BIOMETRIC_TEXTS } from './result-biometric';
import { RESULT_COMPLETED_TEXTS } from './result-completed';

/** Submitting, the success screen, the face check's verdicts, and the returning-link screen. */
export const RESULT_TEXTS: TextGroup = {
  id: 'result',
  title: 'Submission and Result',
  entries: [...RESULT_SUBMIT_TEXTS, ...RESULT_BIOMETRIC_TEXTS, ...RESULT_COMPLETED_TEXTS],
};
