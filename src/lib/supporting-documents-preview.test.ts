import { describe, expect, it } from 'vitest';
import { previewSelectionForSupportingDocuments } from './supporting-documents-preview';

const doc = (key: string, idTypes?: string[]) => ({ key, label: key, idTypes });

/** A flow offering the whole continent, which is where this bit. */
const AFRICA = (country: string, idType: string) =>
  ['AO', 'GH', 'KE', 'NG'].includes(country) && ['bvn', 'nin', 'passport'].includes(idType);

describe('previewSelectionForSupportingDocuments', () => {
  // The real case: a multi-region flow sits on its primary country, which is
  // whichever sorts first, and a document scoped to NG/nin is invisible.
  it('finds the frame a scoped document appears in, in another country', () => {
    expect(
      previewSelectionForSupportingDocuments({
        config: { enabled: true, types: [doc('identity_slip', ['NG/nin'])] },
        country: 'AO',
        isOffered: AFRICA,
      }),
    ).toEqual({ country: 'NG', idType: 'nin' });
  });

  it('leaves an unscoped document alone', () => {
    // Asked of everyone, so no frame shows more than the one we are on.
    expect(
      previewSelectionForSupportingDocuments({
        config: { enabled: true, types: [doc('mandate')] },
        country: 'AO',
        isOffered: AFRICA,
      }),
    ).toBeNull();
  });

  it('picks the frame that surfaces the most documents', () => {
    expect(
      previewSelectionForSupportingDocuments({
        config: {
          enabled: true,
          types: [doc('a', ['GH/passport']), doc('b', ['NG/nin']), doc('c', ['NG/nin'])],
        },
        country: 'AO',
        isOffered: AFRICA,
      }),
    ).toEqual({ country: 'NG', idType: 'nin' });
  });

  it('keeps a selection that already shows as many', () => {
    expect(
      previewSelectionForSupportingDocuments({
        config: { enabled: true, types: [doc('identity_slip', ['NG/nin'])] },
        country: 'AO',
        isOffered: AFRICA,
        selected: { country: 'NG', idType: 'nin' },
      }),
    ).toBeNull();
  });

  it('matches the composite case-insensitively, as the config may store it', () => {
    expect(
      previewSelectionForSupportingDocuments({
        config: { enabled: true, types: [doc('slip', ['ng/nin'])] },
        country: 'AO',
        isOffered: AFRICA,
      }),
    ).toEqual({ country: 'NG', idType: 'nin' });
  });

  it('says nothing when the flow does not offer the scoped frame', () => {
    // An authoring mistake, and the honest preview is the empty step rather
    // than a country the applicant could never pick.
    expect(
      previewSelectionForSupportingDocuments({
        config: { enabled: true, types: [doc('ghana_card', ['ZA/national-id'])] },
        country: 'AO',
        isOffered: AFRICA,
      }),
    ).toBeNull();
  });

  it('says nothing when the step is off', () => {
    expect(
      previewSelectionForSupportingDocuments({
        config: { types: [doc('slip', ['NG/nin'])] },
        country: 'AO',
        isOffered: AFRICA,
      }),
    ).toBeNull();
  });
});
