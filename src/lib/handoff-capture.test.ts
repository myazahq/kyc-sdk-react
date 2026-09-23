import { describe, expect, it } from 'vitest';
import { handoffCaptureNeeded } from './handoff-capture';

// Offering the handoff is not free: it mints a child session and moves the
// budget to it, and the desktop cannot write again until that child is
// cancelled. So a false positive here strands somebody on the device they are
// actually using, which is exactly what happened on a proof-of-address-only
// address flow.
describe('handoffCaptureNeeded', () => {
  it('is FALSE for an address flow that only asks for a document', () => {
    expect(handoffCaptureNeeded({ scope: 'address', proofOfAddress: { enabled: true } } as never)).toBe(false);
  });

  it('is true for an address flow that collects a pin', () => {
    // The phone knows where it is and has the camera for the entrance photo.
    expect(
      handoffCaptureNeeded({ scope: 'address', addressCollection: { enabled: true } }),
    ).toBe(true);
  });

  it('is FALSE for the entirely typed scopes', () => {
    expect(handoffCaptureNeeded({ scope: 'questionnaire' })).toBe(false);
    expect(handoffCaptureNeeded({ scope: 'contact' })).toBe(false);
  });

  it('is true for the biometric scopes, where the capture IS the flow', () => {
    expect(handoffCaptureNeeded({ scope: 'biometric-authentication' })).toBe(true);
    expect(handoffCaptureNeeded({ scope: 'biometric-enrollment' })).toBe(true);
  });

  it('never reads an absent enableLiveness as liveness on a scoped flow', () => {
    // The defect: `enableLiveness !== false` is true when the field is simply
    // absent, which it always is on a scoped config.
    expect(handoffCaptureNeeded({ scope: 'contact', enableLiveness: undefined })).toBe(false);
  });

  it('keeps the full identity flow unchanged', () => {
    expect(handoffCaptureNeeded({})).toBe(true); // liveness on by default
    expect(handoffCaptureNeeded({ enableLiveness: false })).toBe(true); // document capture still needs a camera
    expect(
      handoffCaptureNeeded({ enableLiveness: false, enableDocumentCapture: false }),
    ).toBe(false);
    // Upload-only documents are picked on this computer.
    expect(
      handoffCaptureNeeded({ enableLiveness: false, allowDocumentScan: false }),
    ).toBe(false);
  });

  it('keeps the KYB rule: the applicant leg or company documents, never a bare lookup', () => {
    expect(handoffCaptureNeeded({ subjectType: 'business' })).toBe(false);
    expect(
      handoffCaptureNeeded({ subjectType: 'business', business: { applicant: { verification: true } } }),
    ).toBe(true);
    expect(
      handoffCaptureNeeded({ subjectType: 'business', business: { documents: { enabled: true } } }),
    ).toBe(true);
    // A business flow is judged on the business rule even with liveness absent.
    expect(handoffCaptureNeeded({ subjectType: 'business', enableLiveness: undefined })).toBe(false);
  });
});
