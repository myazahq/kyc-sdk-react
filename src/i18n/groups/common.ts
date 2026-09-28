import type { TextGroup } from '../types';

/** Buttons and short phrases used on many screens. */
export const COMMON_TEXTS: TextGroup = {
  id: 'common',
  title: 'Common buttons',
  entries: [
    { key: 'common.continue', label: 'Continue', default: 'Continue' },
    { key: 'common.continueAnyway', label: 'Continue anyway', default: 'Continue anyway' },
    { key: 'common.back', label: 'Back', default: 'Back' },
    { key: 'common.done', label: 'Done', default: 'Done' },
    { key: 'common.close', label: 'Close', default: 'Close' },
    { key: 'common.cancel', label: 'Cancel', default: 'Cancel' },
    { key: 'common.tryAgain', label: 'Try again', default: 'Try again' },
    { key: 'common.retake', label: 'Retake', default: 'Retake' },
    { key: 'common.skip', label: 'Skip', default: 'Skip' },
    { key: 'common.upload', label: 'Upload', default: 'Upload' },
    { key: 'common.submit', label: 'Submit', default: 'Submit' },
    { key: 'common.loading', label: 'Loading', default: 'Loading…' },
  ],
};
