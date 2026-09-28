import type { TextGroup } from '../types';
import { PRESENCE_CAPTURE_ENTRIES } from './presence-capture';
import { PRESENCE_OUTCOME_ENTRIES } from './presence-outcome';

/** The selfie and liveness step: camera, guidance, challenges, failures and the review. */
export const PRESENCE_TEXTS: TextGroup = {
  id: 'presence',
  title: 'Presence',
  entries: [...PRESENCE_CAPTURE_ENTRIES, ...PRESENCE_OUTCOME_ENTRIES],
};
