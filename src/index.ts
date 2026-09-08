// Components
export { MyazaKYC, useMyazaKYC } from './MyazaKYC';

// Biometric face re-authentication — the returning-user "prove it's still you"
// flow (a verified user re-authenticates with a live selfie, no re-KYC).
export { MyazaBiometricAuth } from './MyazaBiometricAuth';
export type { MyazaBiometricAuthProps, MyazaBiometricAuthConfig } from './MyazaBiometricAuth';

// Hosted "continue on your phone" entry — mounted by the Myaza-hosted
// verification page (`/verify/<token>`), not by integrators directly.
export { MyazaKYCHosted } from './MyazaKYCHosted';
export { HostedLoadingScreen } from './hosted/HostedScreen';
export type { MyazaKYCHostedProps, MyazaKYCHostedReadyInfo } from './MyazaKYCHosted';

// Context (for advanced usage)
export { KYCProvider, useKYCContext } from './context/KYCContext';

// Types
export type {
  MyazaKYCConfig,
  MyazaKYCProps,
  UseMyazaKYCReturn,
  KYCStep,
  KYCAppearance,
  KYCConsentContent,
  KYCSuccessContent,
  VoiceGuidanceConfig,
  VoiceGuidanceOption,
  SupportedCountry,
  AnyCountry,
  IdType,
  AnyIdType,
  QuestionnaireConfig,
  QuestionnaireField,
  QuestionnaireFieldOption,
  QuestionnaireAnswerValue,
  EmailVerificationConfig,
  PhoneVerificationConfig,
  OtpInputStyle,
} from './types/config';

export type {
  KYCSubmission,
  KYCResult,
  KYCErrorCode,
  KYCErrorDetails,
} from './types/verification';

// The biometric scopes' flow options (selfie review, where the verdict lands,
// the Done button), resolved the same way on the server and every SDK.
export type { BiometricFlowConfig, BiometricFlowOptions, BiometricCopy, BiometricCopyText } from './lib/biometric-options';
export { biometricFlowOptions, showsSelfieReview, waitsForResult, showsDoneButton } from './lib/biometric-options';

// Verification Flow types — the dashboard-built config templates the SDK can
// run from via the `workflowId` prop.
export type { WorkflowConfigPayload, WorkflowResolutionResponse } from './services/api';

// Business (KYB) workflow types — workflow-required; the SDK enters the
// business flow only when the resolved config carries subjectType 'business'.
export type {
  SubjectType,
  WorkflowBusinessConfig,
  WorkflowKeyPeopleConfig,
  WorkflowBusinessDocumentsConfig,
  WorkflowBusinessDocumentTypeConfig,
  WorkflowBusinessApplicantConfig,
  BusinessDocumentKey,
  KeyPersonRole,
  ApplicantRole,
} from './types/business';

// `KYCError` is a class (extends Error) — export it as a value so consumers can
// `instanceof`-narrow the error passed to onError.
export { KYCError } from './types/verification';

// The branded QR, exported so the dashboard renders the SAME code an applicant
// sees in the SDK rather than growing a second, plainer one of its own.
export { StyledQRCode, type StyledQRCodeProps } from './components/StyledQRCode';
export { MYAZA_QR_LOGO } from './lib/qr-logo';
