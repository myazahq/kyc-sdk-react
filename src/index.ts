// Components
export { MyazaKYC, useMyazaKYC } from './MyazaKYC';

// Context (for advanced usage)
export { KYCProvider, useKYCContext } from './context/KYCContext';

// Types
export type {
  MyazaKYCConfig,
  SdkEnvironment,
  UseMyazaKYCReturn,
  KYCStep,
  KYCAppearance,
  KYCConsentContent,
  SupportedCountry,
  IdType,
} from './types/config';

export type {
  KYCSubmission,
  KYCError,
  KYCErrorCode,
} from './types/verification';
