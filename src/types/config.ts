import type { KYCSubmission } from './verification';

// ---------------------------------------------------------------------------
// Supported countries & ID types
// ---------------------------------------------------------------------------

export type SupportedCountry = 'NG' | 'GH' | 'KE' | 'ZA' | 'CI';

export type NigeriaIdType = 'bvn' | 'nin' | 'vnin' | 'passport' | 'drivers-license' | 'pvc';
export type GhanaIdType = 'ghana-card' | 'voters' | 'drivers-license' | 'ssnit' | 'passport';
export type KenyaIdType = 'national-id' | 'passport';
export type SouthAfricaIdType = 'national-id';
export type IvoryCoastIdType = 'cni' | 'residence-card';

export type IdType =
  | NigeriaIdType
  | GhanaIdType
  | KenyaIdType
  | SouthAfricaIdType
  | IvoryCoastIdType;

/** Maps a country code to the ID types available in that country. */
export type IdTypeForCountry<C extends SupportedCountry> =
  C extends 'NG' ? NigeriaIdType :
  C extends 'GH' ? GhanaIdType :
  C extends 'KE' ? KenyaIdType :
  C extends 'ZA' ? SouthAfricaIdType :
  C extends 'CI' ? IvoryCoastIdType :
  never;

export interface IdTypeDefinition {
  key: IdType;
  label: string;
  digits?: number;
  pattern?: RegExp;
  /** Whether this ID type requires the user to photograph/upload a physical document. */
  requiresDocumentCapture: boolean;
  /**
   * How many sides of the document need to be scanned.
   * Only present when requiresDocumentCapture is true.
   * 'front_only' — single scan (passports, data-page only)
   * 'front_and_back' — both sides required (cards with info split across sides)
   */
  scanSides?: 'front_only' | 'front_and_back';
}

export type IdTypesByCountry = {
  [K in SupportedCountry]: readonly IdTypeDefinition[];
};

// ---------------------------------------------------------------------------
// KYC flow steps
// ---------------------------------------------------------------------------

export type KYCStep =
  | 'consent'
  | 'id-type'
  | 'id-input'
  | 'document-capture'
  | 'liveness'
  | 'submitted';

// ---------------------------------------------------------------------------
// Appearance / theming
// ---------------------------------------------------------------------------

export interface KYCAppearance {
  /** Brand color — drives buttons, selected states, focus rings (`--primary`/`--ring`). */
  primaryColor?: string;
  /** Text/icon color rendered on top of `primaryColor` (e.g. button labels) (`--primary-foreground`). */
  primaryTextColor?: string;
  /** Accent color for subtle hover/active surfaces (`--accent`). */
  accentColor?: string;
  /** Modal background color (`--background`). */
  backgroundColor?: string;
  /** Elevated surface color for cards/panels (`--secondary` + `--muted`). */
  surfaceColor?: string;
  /** Border + input outline color (`--border` + `--input`). */
  borderColor?: string;
  /** Primary text color (`--foreground`). */
  textColor?: string;
  companyName?: string;
  /**
   * Logo to show in the flow.
   * - An image URL renders that logo.
   * - The literal `'default'` renders the org's own logo from the server config
   *   response (falls back to the built-in shield if the org has none set).
   * - Omitted renders the built-in shield badge.
   */
  logo?: string;
  /** Initial light/dark mode. Applied on mount; the theme toggle can flip it. */
  theme?: 'light' | 'dark';
}

// ---------------------------------------------------------------------------
// Consent screen content
// ---------------------------------------------------------------------------

export interface KYCConsentContent {
  /**
   * Heading on the consent (welcome) screen. Supports `{firstName}` and
   * `{lastName}` tokens, which are replaced with the values from `userData`
   * (empty string when absent). Defaults to `Welcome, {firstName}` when a first
   * name is known, otherwise `Identity Verification`.
   */
  title?: string;
  /**
   * Sub-text under the heading. Supports the same `{firstName}` / `{lastName}`
   * tokens. Defaults to the built-in regulatory copy.
   */
  description?: string;
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

/** Which Myaza backend the SDK talks to. Resolved to a base URL on mount. */
export type SdkEnvironment = 'development' | 'staging' | 'production';

// ---------------------------------------------------------------------------
// Client-side SDK config  (<MyazaKYC /> props & useMyazaKYC options)
// ---------------------------------------------------------------------------

export interface MyazaKYCConfig<C extends SupportedCountry = SupportedCountry> {
  /** Bearer token sent as Authorization header to the server */
  apiKey: string;

  /** Target backend. Resolved to a base URL: staging/production are hardcoded; development uses `devUrl`. */
  environment: SdkEnvironment;

  /**
   * Only used when environment is 'development'. Defaults to 'http://localhost:3000'.
   * Has no effect for staging or production.
   */
  devUrl?: string;

  /** Two-letter country code */
  country: C;

  /** Subset of ID types to offer. Only types valid for the given country are accepted. */
  idTypes?: IdTypeForCountry<C>[];

  /** Pre-populated user data. Fields provided here won't be collected again. */
  userData?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  };

  /** Enable the live-selfie capture step */
  enableSelfie?: boolean;

  /** Enable the document-photo capture step */
  enableDocumentCapture?: boolean;

  /** Enable liveness detection during selfie capture (default: true) */
  enableLiveness?: boolean;

  /** Show a light/dark mode toggle button inside the modal header */
  showThemeToggle?: boolean;

  /** Visual customisation */
  appearance?: KYCAppearance;

  /** Override the consent (welcome) screen copy. */
  consent?: KYCConsentContent;

  /** Arbitrary metadata forwarded with every verification request */
  metadata?: Record<string, string>;

  // Callbacks
  onStart?: () => void;
  onStepChange?: (step: KYCStep) => void;
  /**
   * Fires immediately after the user submits their verification.
   * The submission is always status: 'pending' — results arrive async via webhook.
   */
  onSubmit?: (submission: KYCSubmission) => void;
  onClose?: () => void;
  onError?: (error: Error) => void;
}

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseMyazaKYCReturn {
  open: () => void;
  close: () => void;
  isOpen: boolean;
  currentStep: KYCStep | null;
}
