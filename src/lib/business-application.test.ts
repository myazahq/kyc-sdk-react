import { describe, expect, it } from 'vitest';
import {
  businessSectionSteps,
  hasApplicantVerification,
  hasBusinessDocumentsStep,
  hasKeyPeopleCollection,
  isKeyPersonRowValid,
  keyPeoplePayload,
  lastBusinessSectionStep,
  nextBusinessStep,
  prevBusinessStep,
  resolveBusinessDocumentTypes,
  splitFullName,
} from './business-application';
import type { WorkflowBusinessConfig } from '../types/business';

const base: WorkflowBusinessConfig = { country: 'NG' };
const full: WorkflowBusinessConfig = {
  country: 'NG',
  keyPeople: { enabled: true, collect: true },
  documents: { enabled: true },
  applicant: { verification: true },
};

describe('step gates', () => {
  it('keyPeople collection needs enabled AND collect', () => {
    expect(hasKeyPeopleCollection(base)).toBe(false);
    expect(hasKeyPeopleCollection({ ...base, keyPeople: { enabled: true } })).toBe(false);
    expect(hasKeyPeopleCollection({ ...base, keyPeople: { collect: true } })).toBe(false);
    expect(hasKeyPeopleCollection({ ...base, keyPeople: { enabled: true, collect: true } })).toBe(true);
  });

  it('documents + applicant gates', () => {
    expect(hasBusinessDocumentsStep(base)).toBe(false);
    expect(hasBusinessDocumentsStep(full)).toBe(true);
    expect(hasApplicantVerification(base)).toBe(false);
    expect(hasApplicantVerification(full)).toBe(true);
  });
});

describe('resolveBusinessDocumentTypes', () => {
  it('defaults to a required incorporation certificate when types absent/empty', () => {
    expect(resolveBusinessDocumentTypes({ ...base, documents: { enabled: true } })).toEqual([
      { key: 'incorporation_certificate', label: 'Certificate of incorporation', required: true },
    ]);
    expect(resolveBusinessDocumentTypes({ ...base, documents: { enabled: true, types: [] } })).toEqual([
      { key: 'incorporation_certificate', label: 'Certificate of incorporation', required: true },
    ]);
  });

  it('applies default labels, custom labels, and the required flag', () => {
    const types = resolveBusinessDocumentTypes({
      ...base,
      documents: {
        enabled: true,
        types: [
          { key: 'memart', required: true },
          { key: 'tax_document', label: 'TIN certificate' },
        ],
      },
    });
    expect(types).toEqual([
      { key: 'memart', label: 'MEMART / articles of association', required: true },
      { key: 'tax_document', label: 'TIN certificate', required: false },
    ]);
  });

  it('is empty when the step is not enabled', () => {
    expect(resolveBusinessDocumentTypes(base)).toEqual([]);
    expect(resolveBusinessDocumentTypes(undefined)).toEqual([]);
  });
});

describe('section sequencing', () => {
  it('orders the configured steps', () => {
    expect(businessSectionSteps(base)).toEqual(['business-details']);
    expect(businessSectionSteps(full)).toEqual([
      'business-details',
      'business-key-people',
      'business-documents',
      'applicant-role',
    ]);
  });

  it('nextBusinessStep walks the section, then questionnaire/submitted', () => {
    expect(nextBusinessStep('business-details', { business: full })).toBe('business-key-people');
    expect(nextBusinessStep('business-key-people', { business: full })).toBe('business-documents');
    expect(nextBusinessStep('business-documents', { business: full })).toBe('applicant-role');
    expect(nextBusinessStep('applicant-role', { business: full })).toBe('id-type');
    expect(nextBusinessStep('business-details', { business: base })).toBe('submitted');
    expect(
      nextBusinessStep('business-details', {
        business: base,
        questionnaire: { fields: [{ key: 'a', label: 'A', type: 'text' }] },
      }),
    ).toBe('questionnaire');
  });

  it('prevBusinessStep mirrors, landing on consent at the front', () => {
    expect(prevBusinessStep('business-details', full)).toBe('consent');
    expect(prevBusinessStep('business-key-people', full)).toBe('business-details');
    expect(prevBusinessStep('business-documents', full)).toBe('business-key-people');
    expect(prevBusinessStep('applicant-role', full)).toBe('business-documents');
    // Unconfigured middle steps are skipped in both directions.
    const docsOnly: WorkflowBusinessConfig = { ...base, documents: { enabled: true } };
    expect(prevBusinessStep('business-documents', docsOnly)).toBe('business-details');
  });

  it('lastBusinessSectionStep is the questionnaire back target', () => {
    expect(lastBusinessSectionStep(base)).toBe('business-details');
    expect(lastBusinessSectionStep({ ...base, documents: { enabled: true } })).toBe('business-documents');
  });
});

describe('key-people rows', () => {
  const valid = { name: 'Bola Owner', role: 'beneficial_owner' as const, email: '', country: '', ownershipPct: '' };

  it('validates name, role, optional email and ownership', () => {
    expect(isKeyPersonRowValid(valid)).toBe(true);
    expect(isKeyPersonRowValid({ ...valid, name: ' B ' })).toBe(false);
    expect(isKeyPersonRowValid({ ...valid, email: 'not-an-email' })).toBe(false);
    expect(isKeyPersonRowValid({ ...valid, email: 'bola@x.com' })).toBe(true);
    expect(isKeyPersonRowValid({ ...valid, ownershipPct: '101' })).toBe(false);
    expect(isKeyPersonRowValid({ ...valid, ownershipPct: '60' })).toBe(true);
  });

  it('maps valid rows to the payload shape, dropping empty optionals', () => {
    expect(
      keyPeoplePayload([
        { name: ' Bola Owner ', role: 'beneficial_owner', email: 'bola@x.com', country: 'ng', ownershipPct: '60' },
        { name: 'Jide Director', role: 'director', email: '', country: '', ownershipPct: '' },
        { name: '', role: 'director', email: '', country: '', ownershipPct: '' }, // invalid → dropped
      ]),
    ).toEqual([
      { name: 'Bola Owner', role: 'beneficial_owner', email: 'bola@x.com', country: 'NG', ownershipPct: 60 },
      { name: 'Jide Director', role: 'director' },
    ]);
  });
});

describe('splitFullName', () => {
  it('splits into first/last, tolerating single tokens and blanks', () => {
    expect(splitFullName('John Doe')).toEqual({ firstName: 'John', lastName: 'Doe' });
    expect(splitFullName('  Ada  Ngozi   Obi ')).toEqual({ firstName: 'Ada', lastName: 'Ngozi Obi' });
    expect(splitFullName('Cher')).toEqual({ firstName: 'Cher' });
    expect(splitFullName('   ')).toBeUndefined();
  });
});
