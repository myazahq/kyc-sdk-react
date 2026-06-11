import type { ButtonHTMLAttributes } from 'react';

import type { KYCSubmission, KYCError } from './verification';

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
// Success (submitted) screen content
// ---------------------------------------------------------------------------

export interface KYCSuccessContent {
  /**
   * Heading on the success screen shown after a verification is submitted.
   * Supports `{firstName}` and `{lastName}` tokens, replaced with the values
   * from `userData` (empty string when absent). Defaults to
   * `Verification Submitted!`.
   */
  title?: string;
  /**
   * Sub-text under the heading. Supports the same `{firstName}` / `{lastName}`
   * tokens. Defaults to the built-in "submitted for review" copy.
   */
  description?: string;
}

// ---------------------------------------------------------------------------
// Voice guidance (spoken liveness instructions)
// ---------------------------------------------------------------------------

/**
 * Configuration for the spoken liveness instructions ("nod your head",
 * "blink", …). This is text-to-speech **output** played to the user for
 * accessibility — it never records audio, so no microphone permission is
 * involved.
 *
 * Structured as an object (rather than a bare boolean) so a `language` can be
 * added later without a breaking change — Myaza operates across NG/GH/KE/ZA/CI,
 * and French guidance for CI is a likely future need.
 */
export interface VoiceGuidanceConfig {
  /** Whether spoken guidance plays. Default `true` (on for accessibility). */
  enabled?: boolean;
  /**
   * BCP-47 language tag for the spoken voice (e.g. `'en-US'`, `'fr-FR'`).
   * Defaults to `'en-US'`. Currently selects the TTS voice only; the spoken
   * text still mirrors the on-screen English instruction (localized strings
   * are a planned follow-up).
   */
  language?: string;
}

/**
 * `voiceGuidance` prop value. Accepts a bare boolean for ergonomics
 * (`voiceGuidance={false}`) or the full {@link VoiceGuidanceConfig} object.
 */
export type VoiceGuidanceOption = boolean | VoiceGuidanceConfig;

// ---------------------------------------------------------------------------
// Client-side SDK config  (<MyazaKYC /> props & useMyazaKYC options)
// ---------------------------------------------------------------------------

export interface MyazaKYCConfig<C extends SupportedCountry = SupportedCountry> {
  /**
   * Bearer token sent as the Authorization header. The key prefix is the single
   * source of truth for the environment — the SDK derives it (and the base URL)
   * automatically: `pk_dev_…` → development, `pk_test_…` → sandbox,
   * `pk_live_…` → production. An unrecognized prefix throws.
   */
  apiKey: string;

  /**
   * Dev-only base-URL override. Only applied for **development** keys
   * (`pk_dev_…`); defaults to `http://localhost:3001`. Ignored for sandbox /
   * production keys.
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

  /**
   * Allow picking a document photo from the device (gallery / file picker /
   * drag-and-drop) as an alternative to the live camera capture. Default `true`.
   * When `false`, all "upload a photo instead" affordances are hidden and the
   * user must capture with the camera.
   */
  allowDocumentUpload?: boolean;

  /** Enable liveness detection during selfie capture (default: true) */
  enableLiveness?: boolean;

  /**
   * Spoken liveness instructions (accessibility). `true`/omitted = on,
   * `false` = off, or a {@link VoiceGuidanceConfig} for finer control
   * (e.g. `{ enabled: true, language: 'fr-FR' }`). TTS output only — no
   * microphone is used. Default: on.
   */
  voiceGuidance?: VoiceGuidanceOption;

  /** Show a light/dark mode toggle button inside the modal header. Default `true`. */
  showThemeToggle?: boolean;

  /**
   * Hide the close (X) button and block all user-initiated dismissal of the
   * modal — backdrop tap, Escape key, and (on mobile) swipe-down. When `true`,
   * the flow can only be closed programmatically via the `close()` returned by
   * {@link useMyazaKYC}. Default `false`. The terminal "Submitted" step is
   * already non-dismissible regardless of this flag.
   */
  disableClose?: boolean;

  /** Visual customisation */
  appearance?: KYCAppearance;

  /** Override the consent (welcome) screen copy. */
  consent?: KYCConsentContent;

  /** Override the success (submitted) screen copy. */
  success?: KYCSuccessContent;

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
  /**
   * Fires for technical errors only. Receives a {@link KYCError} — a real
   * `Error` that also carries a typed `code` (e.g. `camera_permission_denied`,
   * `upload_failed`, `network_error`). Verification *outcomes* never come
   * through here — they arrive via webhook / status polling.
   */
  onError?: (error: KYCError) => void;
}

// ---------------------------------------------------------------------------
// <MyazaKYC /> component props
// ---------------------------------------------------------------------------

/**
 * Props for the `<MyazaKYC />` component: the full SDK config plus standard
 * `<button>` attributes for the built-in trigger button.
 *
 * The trigger renders a real `<button>`, so you can:
 * - pass `children` to set the button label/content (defaults to
 *   `Verify with {companyName}` / `Verify Identity`),
 * - pass `className` to restyle it (merged via `tailwind-merge`, so your
 *   classes override the defaults),
 * - forward any other button attribute (`disabled`, `aria-*`, `type`, …).
 *
 * `onClick` is owned by the SDK (it opens the modal) and is therefore omitted.
 * To build your own trigger element instead, use the `useMyazaKYC()` hook and
 * wire its `open()` to whatever you render.
 */
export type MyazaKYCProps<C extends SupportedCountry = SupportedCountry> =
  MyazaKYCConfig<C> &
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof MyazaKYCConfig<C> | 'onClick'>;

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface UseMyazaKYCReturn {
  open: () => void;
  close: () => void;
  isOpen: boolean;
  currentStep: KYCStep | null;
}
