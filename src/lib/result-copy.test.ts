import { describe, expect, it } from 'vitest';
import { createTextFn, defaultText } from '../i18n/translate';
import { describeOutcome, describeWaiting } from './result-copy';

const declined = { kind: 'settled' as const, status: 'declined' as const, reason: 'The selfie did not match.', reasonCode: 'x' };

describe('result copy from the text catalogue', () => {
  it("uses the workflow's own text, and the dedicated biometric.copy field still wins in English", () => {
    const t = createTextFn({ en: { 'result.faceCheck.checking.title': 'Hang on' } });
    expect(describeWaiting({ scope: 'biometric-authentication', waitsForResult: true }, t).title).toBe('Hang on');
    const legacy = describeWaiting(
      { scope: 'biometric-authentication', waitsForResult: true, override: { title: 'One moment, Ada' } },
      t,
    );
    expect(legacy.title).toBe('One moment, Ada');
  });

  it('reads the retry line through the text function it is given', () => {
    const t: typeof defaultText = (key, vars, legacy) =>
      key === 'result.submitting.retrying' ? `Nouvel essai (${vars?.attempt}/${vars?.total}).` : defaultText(key, vars, legacy);
    expect(describeWaiting({ scope: null, waitsForResult: false, retry: { attempt: 2, total: 3 } }, t).description).toBe(
      'Nouvel essai (2/3).',
    );
  });

  it("a workflow's declined description wins over the server's reason, as the dedicated field does", () => {
    expect(describeOutcome(declined).description).toBe('The selfie did not match.');
    const t = createTextFn({ en: { 'result.faceCheck.declined.description': 'Please visit a branch.' } });
    expect(describeOutcome(declined, undefined, t).description).toBe('Please visit a branch.');
  });
});
