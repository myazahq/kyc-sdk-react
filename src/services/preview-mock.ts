import type { KYCApi, VerificationStatusResponse, VerifyResponse } from './api';

/**
 * Preview-mode API wrapper (builder live preview). Every WRITE is stubbed so
 * walking the flow never leaves the browser — document photos, selfies, and
 * liveness videos are not uploaded, and no Verification row is ever created.
 * Read-only calls (config/workflow resolution) pass through untouched: the
 * preview still reflects the org's real granted ID types and branding.
 */
export function withPreviewMocks(api: KYCApi): KYCApi {
  let mediaCounter = 0;
  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  return {
    ...api,

    async upload(): Promise<string> {
      await delay(350); // keep the real "uploading…" affordance visible
      mediaCounter += 1;
      return `preview_media_${mediaCounter}`;
    },

    async verify(): Promise<VerifyResponse> {
      await delay(500);
      // applicantKeyPersonId stays null so the KYB applicant double-submit
      // never fires in preview (nothing real to link it to).
      return { verificationId: 'preview_verification', status: 'pending', applicantKeyPersonId: null, keyPeopleInvites: [] };
    },

    async status(verificationId: string): Promise<VerificationStatusResponse> {
      return {
        verificationId,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
    },

    async createHandoffSession(): Promise<never> {
      throw new Error('Device handoff is unavailable in preview mode.');
    },
  };
}
