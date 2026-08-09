import { describe, expect, it } from 'vitest';

/**
 * Mirrors the derivation in ConsentStep. This is a LEGAL notice, so it has two
 * failure modes and both matter:
 *
 *   • overclaiming — promising facial recognition on a flow with no selfie step
 *     is a false statement about what we do with someone's data;
 *   • underclaiming — recording video without saying so is the one that has
 *     actual regulatory consequences.
 *
 * The copy is therefore derived from the flow, never hardcoded.
 */
const disclosure = (config: {
  isBusiness?: boolean;
  enableSelfie?: boolean;
  enableDocumentCapture?: boolean;
  applicantVerification?: boolean;
}) => {
  const isBusiness = config.isBusiness === true;
  const capturesFace = isBusiness
    ? config.applicantVerification === true
    : config.enableSelfie !== false;
  const recordsVideo =
    capturesFace || (!isBusiness && config.enableDocumentCapture !== false);
  return { capturesFace, recordsVideo };
};

describe('what the consent notice claims', () => {
  it('names facial recognition on a normal individual flow', () => {
    expect(disclosure({})).toEqual({ capturesFace: true, recordsVideo: true });
  });

  it('does NOT claim facial recognition when the selfie step is off', () => {
    // Overclaiming: the flow never touches a face, so saying we run facial
    // recognition would be false.
    const d = disclosure({ enableSelfie: false });
    expect(d.capturesFace).toBe(false);
  });

  it('STILL discloses video when only document capture runs', () => {
    // The dangerous gap. Document capture records documentFrontVideo, so a
    // notice gated solely on the selfie would record video silently.
    expect(disclosure({ enableSelfie: false })).toEqual({
      capturesFace: false,
      recordsVideo: true,
    });
  });

  it('claims nothing biometric on a plain KYB flow', () => {
    // No camera at all in the business flow without applicant verification.
    expect(disclosure({ isBusiness: true })).toEqual({
      capturesFace: false,
      recordsVideo: false,
    });
  });

  it('claims biometrics on KYB WITH applicant verification', () => {
    // The applicant runs a full individual KYC leg — face included — so the
    // business flow does become biometric here.
    expect(disclosure({ isBusiness: true, applicantVerification: true })).toEqual({
      capturesFace: true,
      recordsVideo: true,
    });
  });

  it('never claims video without also being able to justify it', () => {
    // capturesFace ⇒ recordsVideo, always. A face capture always rides a
    // recorded liveness/capture session.
    for (const cfg of [{}, { enableDocumentCapture: false }, { isBusiness: true, applicantVerification: true }]) {
      const d = disclosure(cfg);
      if (d.capturesFace) expect(d.recordsVideo).toBe(true);
    }
  });
});
