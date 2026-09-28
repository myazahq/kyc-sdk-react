import type { TextGroup } from '../types';
import { UPLOAD_DOCUMENT_CAPTURE_ENTRIES } from './uploadDocument-capture';
import { UPLOAD_DOCUMENT_REVIEW_ENTRIES } from './uploadDocument-review';

export const UPLOAD_DOCUMENT_TEXTS: TextGroup = {
  id: 'uploadDocument',
  title: 'Upload Document',
  entries: [...UPLOAD_DOCUMENT_CAPTURE_ENTRIES, ...UPLOAD_DOCUMENT_REVIEW_ENTRIES],
};
