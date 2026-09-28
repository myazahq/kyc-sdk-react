import type { TextEntry } from '../types';

/** The business documents step. */
export const BUSINESS_DOCUMENTS_TEXTS: TextEntry[] = [
  { key: 'business.documents.title', label: 'Documents: title', default: 'Business documents' },
  {
    key: 'business.documents.description',
    label: 'Documents: description',
    default:
      'Upload the supporting documents for your business. Each one must clearly show the registered business name and registration number. Required documents are marked with *.',
    multiline: true,
  },
  { key: 'business.documents.type.incorporationCertificate', label: 'Document: incorporation certificate', default: 'Certificate of incorporation' },
  { key: 'business.documents.type.memart', label: 'Document: MEMART', default: 'MEMART / articles of association' },
  { key: 'business.documents.type.proofOfAddress', label: 'Document: proof of address', default: 'Proof of business address' },
  { key: 'business.documents.type.taxDocument', label: 'Document: tax document', default: 'Tax document' },
  { key: 'business.documents.type.regulatoryLicense', label: 'Document: regulatory licence', default: 'Regulatory license' },
  { key: 'business.documents.type.boardResolution', label: 'Document: board resolution', default: 'Board resolution' },
  { key: 'business.documents.type.other', label: 'Document: other', default: 'Other document' },
  { key: 'business.documents.uploading', label: 'Documents: uploading', default: 'Uploading…' },
  { key: 'business.documents.replace', label: 'Documents: replace button', default: 'Replace' },
  { key: 'business.documents.errorFileType', label: 'Error: wrong file type', default: 'Please upload a PDF, JPG or PNG file.' },
  {
    key: 'business.documents.errorUpload',
    label: 'Error: upload failed',
    default: 'Upload failed. Please check your connection and try again.',
  },
];
