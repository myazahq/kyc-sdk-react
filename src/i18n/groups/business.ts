import type { TextGroup } from '../types';
import { BUSINESS_DETAILS_TEXTS } from './business-details';
import { BUSINESS_REGISTRATION_TEXTS } from './business-registration';
import { BUSINESS_COMPANY_TEXTS } from './business-company';
import { BUSINESS_COUNTRY_TEXTS } from './business-country';
import { BUSINESS_DOCUMENTS_TEXTS } from './business-documents';
import { BUSINESS_APPLICANT_TEXTS } from './business-applicant';

/** The business (KYB) application: details, company search, documents and the applicant's role. */
export const BUSINESS_TEXTS: TextGroup = {
  id: 'business',
  title: 'Business Details',
  entries: [
    ...BUSINESS_DETAILS_TEXTS,
    ...BUSINESS_REGISTRATION_TEXTS,
    ...BUSINESS_COMPANY_TEXTS,
    ...BUSINESS_COUNTRY_TEXTS,
    ...BUSINESS_DOCUMENTS_TEXTS,
    ...BUSINESS_APPLICANT_TEXTS,
  ],
};
