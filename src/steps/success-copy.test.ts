import { describe, expect, it } from 'vitest';
import { createTextFn } from '../i18n/translate';
import { successAction, successDescription, successTitle } from './success-copy';

const tokens = { firstName: 'Ada', lastName: 'Okafor', businessName: 'Acme Ltd' };

describe('success copy', () => {
  it('keeps the default words and the scope-honest descriptions', () => {
    expect(successTitle(undefined, tokens)).toBe('Verification Submitted!');
    expect(successDescription(undefined, tokens, true)).toBe(
      "Your business verification has been submitted for review. You'll be notified of the result.",
    );
    expect(successDescription(undefined, tokens, false, 'address')).toBe(
      "Your address verification has been submitted. You'll be notified of the result.",
    );
  });

  it("the org's success fields win, tokens filled, over the workflow's catalogue text", () => {
    const t = createTextFn({ en: { 'result.success.title': 'All done' } });
    expect(successTitle(undefined, tokens, t)).toBe('All done');
    expect(successTitle({ title: 'Thanks, {firstName}' }, tokens, t)).toBe('Thanks, Ada');
    expect(successDescription({ description: '{businessName} is in review.' }, tokens, true, null, t)).toBe(
      'Acme Ltd is in review.',
    );
  });

  it('labels the terminal affordance', () => {
    expect(successAction({ success: undefined, hostedMode: false, tokens, onClose: () => {} })).toMatchObject({ label: 'Done' });
    expect(successAction({ success: undefined, hostedMode: true, tokens, onClose: () => {} })).toEqual({
      note: "You're all set, you can close this tab.",
    });
    const redirect = { redirectUrl: 'https://acme.example', redirectLabel: '{businessName}' };
    expect(successAction({ success: redirect, hostedMode: true, tokens, onClose: () => {} })).toMatchObject({ label: 'Acme Ltd' });
    const blank = { redirectUrl: 'https://acme.example', redirectLabel: '{businessName}' };
    expect(successAction({ success: blank, hostedMode: true, tokens: {}, onClose: () => {} })).toMatchObject({ label: 'Continue' });
  });
});
