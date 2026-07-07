import { describe, expect, it } from 'vitest';
import { mergeWorkflowConfig } from './workflow-merge';

describe('mergeWorkflowConfig', () => {
  it('flow config wins over overlapping props', () => {
    const merged = mergeWorkflowConfig(
      { country: 'GH', idTypes: ['ghana-card'], enableLiveness: false },
      { country: 'NG', idTypes: ['bvn', 'nin'], enableLiveness: true, apiKey: 'pk_test_x' },
    );
    expect(merged.country).toBe('GH');
    expect(merged.idTypes).toEqual(['ghana-card']);
    expect(merged.enableLiveness).toBe(false);
  });

  it('props fill keys the flow does not define', () => {
    const merged = mergeWorkflowConfig(
      { country: 'NG' },
      { country: 'NG', assetsBasePath: '/my-assets', enableSelfie: false, apiKey: 'pk_test_x' },
    );
    expect(merged.assetsBasePath).toBe('/my-assets');
    expect(merged.enableSelfie).toBe(false);
  });

  it('never touches runtime keys (apiKey, userId, userData, metadata, callbacks)', () => {
    const onSubmit = () => undefined;
    const props: Record<string, unknown> = {
      country: 'NG',
      apiKey: 'pk_test_x',
      userId: 'usr_1',
      userData: { firstName: 'Jane' },
      metadata: { plan: 'gold' },
      onSubmit,
      deviceHandoff: false,
      defaultOpen: true,
    };
    const merged = mergeWorkflowConfig({ country: 'KE', disableClose: true }, props);
    expect(merged.apiKey).toBe('pk_test_x');
    expect(merged.userId).toBe('usr_1');
    expect(merged.userData).toEqual({ firstName: 'Jane' });
    expect(merged.metadata).toEqual({ plan: 'gold' });
    expect(merged.onSubmit).toBe(onSubmit);
    expect(merged.deviceHandoff).toBe(false);
    expect(merged.defaultOpen).toBe(true);
    expect(merged.disableClose).toBe(true);
  });

  it('appearance merges shallowly with flow fields winning per-field', () => {
    const merged = mergeWorkflowConfig(
      { country: 'NG', appearance: { primaryColor: '#111111', theme: 'dark' } },
      { country: 'NG', apiKey: 'pk', appearance: { primaryColor: '#999999', logo: '/logo.svg' } },
    );
    expect(merged.appearance).toEqual({
      primaryColor: '#111111',
      theme: 'dark',
      logo: '/logo.svg',
    });
  });

  it('business (KYB) flows merge subjectType + business and fall back country to the registry country', () => {
    const props: Record<string, unknown> = { apiKey: 'pk_test_x' };
    const merged = mergeWorkflowConfig(
      { subjectType: 'business', business: { country: 'US', products: ['business'] } },
      props,
    );
    expect(merged.subjectType).toBe('business');
    expect(merged.business).toEqual({ country: 'US', products: ['business'] });
    expect(merged.country).toBe('US'); // no top-level country on business workflows
  });

  it('a flow-defined false still overrides a prop true (explicit beats default)', () => {
    const merged = mergeWorkflowConfig(
      { country: 'NG', enableDocumentCapture: false, showThemeToggle: false },
      { country: 'NG', apiKey: 'pk', enableDocumentCapture: true, showThemeToggle: true },
    );
    expect(merged.enableDocumentCapture).toBe(false);
    expect(merged.showThemeToggle).toBe(false);
  });
});
