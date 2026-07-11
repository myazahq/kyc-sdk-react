// ---------------------------------------------------------------------------
// Business (KYB) APPLICATION submission — the registry-details submit plus the
// application extras (documents, key people, applicant declaration), and the
// follow-up APPLICANT submission: a SECOND, ordinary INDIVIDUAL verification
// linked back to the application via `metadata.userId = applicantKeyPersonId`.
// Extracted from SubmittedStep per the 200-line rule.
// ---------------------------------------------------------------------------

import { withRetry } from '../lib/retry';
import { businessProductsForCountry } from '../lib/business';
import {
  hasApplicantVerification,
  hasBusinessDocumentsStep,
  hasKeyPeopleCollection,
  keyPeoplePayload,
  splitFullName,
} from '../lib/business-application';
import { generateRequestId, buildSubmitMetadata, uploadCaptureVideos } from './submit-helpers';
import type { KYCConfigValue } from '../context/KYCConfigContext';
import type { KYCState } from '../context/types';
import type { VerifyRequest } from '../services/api';

interface SubmitBusinessOptions {
  config: KYCConfigValue;
  state: KYCState;
  requestId: string;
  onRetry: (attempt: number, total: number) => void;
}

/**
 * Submit the business application. Resolves with the BUSINESS verificationId;
 * when the server mints an `applicantKeyPersonId` and applicant media was
 * captured, the applicant's own individual verification is submitted
 * fire-and-forget (a failure never blocks the submitted screen — the org can
 * re-invite the applicant from the dashboard).
 */
export async function submitBusinessApplication({
  config,
  state,
  requestId,
  onRetry,
}: SubmitBusinessOptions): Promise<{ verificationId: string; keyPeopleInvites: Array<{ keyPersonId: string; name: string; inviteUrl: string }> }> {
  const business = config.business!;
  const registrationNumber = state.business.registrationNumber.trim();
  const registrationName = state.business.registrationName.trim();
  const contactEmail = state.business.contactEmail.trim();
  const address = state.business.address.trim();
  const email = state.business.email.trim();
  const phone = state.business.phone.trim();
  const website = state.business.website.trim();
  // Multi-registry workflows: the picked country (step state) wins over the
  // workflow's primary; products were already narrowed to that country.
  const country = state.business.country ?? business.country;
  const product = state.business.product ?? businessProductsForCountry(business, country)[0]!;

  const app = state.businessApplication;
  // Application extras ride the business block ONLY when the workflow
  // configures them — the server ignores unconfigured fields anyway.
  const documents =
    hasBusinessDocumentsStep(business) && app.documents.length > 0
      ? app.documents.map((d) => ({ type: d.type, mediaId: d.mediaId }))
      : undefined;
  const keyPeople = hasKeyPeopleCollection(business) ? keyPeoplePayload(app.keyPeople) : [];
  const applicant =
    hasApplicantVerification(business) && app.applicantRole
      ? {
          role: app.applicantRole,
          ...(app.applicantName.trim() ? { name: app.applicantName.trim() } : {}),
        }
      : undefined;

  const result = await withRetry(
    () =>
      config.api.verify({
        country,
        // The product key rides on idType for transport symmetry.
        idType: product,
        business: {
          registrationNumber,
          ...(registrationName ? { registrationName } : {}),
          ...(contactEmail ? { contactEmail } : {}),
          ...(address ? { address } : {}),
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          ...(website ? { website } : {}),
          product,
          ...(documents ? { documents } : {}),
          ...(keyPeople.length > 0 ? { keyPeople } : {}),
          ...(applicant ? { applicant } : {}),
        },
        ...(config.workflowId ? { workflowId: config.workflowId } : {}),
        ...(config.userId ? { userId: config.userId } : {}),
        ...(Object.keys(state.questionnaireAnswers).length > 0
          ? { questionnaire: state.questionnaireAnswers }
          : {}),
        metadata: buildSubmitMetadata(config.metadata, requestId, config.deviceIntelligence !== false),
      }),
    { onRetry },
  );

  // Applicant KYC: fire-and-forget — the submitted screen shows after the
  // BUSINESS submit; a failed applicant submit only warns (non-blocking).
  if (result.applicantKeyPersonId && applicantMediaCaptured(state)) {
    void submitApplicantVerification(config, state, country, result.applicantKeyPersonId).catch(
      (err) => {
        console.warn(
          '[MyazaKYC] Applicant identity submission failed — the organization can re-invite the applicant from the dashboard:',
          err,
        );
      },
    );
  }

  return { verificationId: result.verificationId, keyPeopleInvites: result.keyPeopleInvites ?? [] };
}

/** Whether the applicant capture leg actually produced something to submit. */
function applicantMediaCaptured(state: KYCState): boolean {
  return Boolean(
    state.selectedIdType &&
      (state.mediaIds.selfie || state.mediaIds.documentFront || state.idNumber.trim() !== ''),
  );
}

/**
 * The applicant's own verification — an ordinary INDIVIDUAL submission: the
 * business country, the ID type they picked, their captured media, and
 * `metadata.userId = applicantKeyPersonId` (the server-side link back to the
 * application). Deliberately carries NO workflowId — the KYB workflow is not
 * an individual flow.
 */
async function submitApplicantVerification(
  config: KYCConfigValue,
  state: KYCState,
  country: string,
  applicantKeyPersonId: string,
): Promise<void> {
  const idType = state.selectedIdType!;
  const isNumberOnly =
    config.getIdTypeDefinition(idType, country)?.requiresDocumentCapture === false;
  const idNumber = isNumberOnly ? state.idNumber : undefined;

  // Best-effort capture videos (same contract as the individual flow).
  const videoIds = await uploadCaptureVideos(config.api, state);

  // Name: values typed on the id-input step win; the applicant-role step's
  // optional full name fills the gaps.
  const split = splitFullName(state.businessApplication.applicantName) ?? {};
  const firstName = state.userData.firstName.trim() || split.firstName;
  const lastName = state.userData.lastName.trim() || split.lastName;
  const userData =
    firstName || lastName
      ? { ...(firstName ? { firstName } : {}), ...(lastName ? { lastName } : {}) }
      : undefined;

  const requestId = generateRequestId('kyc');
  const metadata: VerifyRequest['metadata'] = buildSubmitMetadata(
    config.metadata,
    requestId,
    config.deviceIntelligence !== false,
  );
  // The link back to the application — written last so nothing clobbers it.
  metadata.userId = applicantKeyPersonId;

  await withRetry(() =>
    config.api.verify({
      country,
      idType,
      ...(idNumber ? { idNumber } : {}),
      ...(userData ? { userData } : {}),
      mediaIds: {
        documentFront: state.mediaIds.documentFront,
        documentBack: state.mediaIds.documentBack,
        selfie: state.mediaIds.selfie,
        ...videoIds,
      },
      metadata,
    }),
  );
}
