import type { ButtonHTMLAttributes } from 'react';

import type { KYCSubmission, KYCError } from './verification';

// ---------------------------------------------------------------------------
// Supported countries & ID types
// ---------------------------------------------------------------------------

/** The curated countries with LOCAL ID-type definitions (labels, digits/pattern
 *  validation). Kept for compile-time ergonomics — autocomplete and per-country
 *  `idTypes` narrowing. */
export type SupportedCountry = 'NG' | 'GH' | 'KE' | 'ZA' | 'CI';

/**
 * Any ISO-2 country code. Individual KYC is no longer limited to the curated
 * five — the server verifies generic document types (`passport`,
 * `drivers-license`, `national-id`) in any country via Document Intelligence,
 * and supplies the display metadata (label, capture requirements, scan sides)
 * in its idTypes payload. The `(string & {})` keeps the curated literals in
 * autocomplete while still accepting any code.
 */
export type AnyCountry = SupportedCountry | (string & {});

export type NigeriaIdType = 'bvn' | 'bvn-premium' | 'nin' | 'vnin' | 'tax-id' | 'passport' | 'drivers-license' | 'pvc';
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

/** Any ID-type key — curated literals stay in autocomplete, but server-defined
 *  keys (Global Documents) are accepted too. */
export type AnyIdType = IdType | (string & {});

/** Maps a country code to the ID types available in that country. Unknown
 *  (non-curated) countries fall back to `string` — their ID types are defined
 *  server-side, not in the local catalogue. */
export type IdTypeForCountry<C extends AnyCountry> =
  C extends 'NG' ? NigeriaIdType :
  C extends 'GH' ? GhanaIdType :
  C extends 'KE' ? KenyaIdType :
  C extends 'ZA' ? SouthAfricaIdType :
  C extends 'CI' ? IvoryCoastIdType :
  string;

export interface IdTypeDefinition {
  key: AnyIdType;
  label: string;
  /**
   * What the user actually types when it differs from the ID's name — e.g.
   * Tax ID lookups are keyed off the person's NIN, so the input asks for a NIN.
   */
  inputLabel?: string;
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
  // Contact-verification OTP steps — right after consent (cheap pre-filter
  // before document/liveness spend). Present when the workflow/props enable them.
  | 'email-verification'
  | 'phone-verification'
  | 'country-select'
  | 'id-type'
  | 'id-input'
  | 'document-capture'
  // eMRTD chip read — native (mobile) SDKs only; the web SDK never puts it in
  // the step order (Web NFC can't do ISO-DEP) but renders its screen for the
  // builder preview, where it stands in for the visually-identical mobile UI.
  | 'nfc'
  | 'business-details'
  // KYB application steps — present only when the workflow configures them.
  | 'business-key-people'
  | 'business-documents'
  | 'applicant-role'
  | 'liveness'
  | 'proof-of-address'
  | 'questionnaire'
  | 'submitted';

// ---------------------------------------------------------------------------
// Proof of Address (utility bill / bank statement / tenancy document)
// ---------------------------------------------------------------------------

export type PoaDocumentType = 'utility_bill' | 'bank_statement' | 'tenancy_agreement' | 'other';

export interface ProofOfAddressConfig {
  /** Adds the Proof of Address step (after capture, before the questionnaire). */
  enabled?: boolean;
  /** Accepted document kinds (absent = all). */
  documentTypes?: PoaDocumentType[];
  /** Custom label shown for the 'other' document kind (absent = "Other document"). */
  otherLabel?: string;
  /** Recency window the server checks the document date against (default 90). */
  maxAgeDays?: number;
}

// ---------------------------------------------------------------------------
// NFC Chip Verification (eMRTD chip read — mobile SDKs; web = preview stand-in)
// ---------------------------------------------------------------------------

export interface NfcConfig {
  /** Adds the chip-read step (native SDKs; the web SDK renders it for preview only). */
  enabled?: boolean;
  /** Which chip-capable IDs run the step, as "CC/idType" keys (absent = all). */
  idTypes?: string[];
  /**
   * Show a manual "skip" affordance so a user without an NFC-capable device
   * (or who can't complete the read) can proceed. Devices with no NFC radio
   * auto-skip regardless — this is the escape hatch on NFC-capable phones.
   */
  allowSkip?: boolean;
}

// ---------------------------------------------------------------------------
// Contact verification (email / phone OTP possession checks)
// ---------------------------------------------------------------------------

/** Which code field the SDK renders — the org picks this in the builder. */
export type OtpInputStyle = 'segmented' | 'text';

export interface EmailVerificationConfig {
  /** Adds the email OTP step (right after consent). */
  enabled?: boolean;
  /**
   * Whether a verified email is required to proceed (default true when
   * enabled). `false` shows a "skip for now" affordance and the server accepts
   * a submission without the proof.
   */
  required?: boolean;
  /** Number of digits in the code (4–8; default 6). Drives the OTP-input slots. */
  codeLength?: number;
  /** Wrong-code entries allowed per code before it's dead (1–5; default 3). */
  maxAttempts?: number;
  /** Code field style: 'segmented' boxes (default) or a plain 'text' input. */
  inputStyle?: OtpInputStyle;
}

export interface PhoneVerificationConfig {
  /** Adds the phone OTP step (right after consent / email verification). */
  enabled?: boolean;
  /** Required to proceed (default true when enabled); `false` adds a skip. */
  required?: boolean;
  /** Number of digits in the code (4–8; default 6). Drives the OTP-input slots. */
  codeLength?: number;
  /** Wrong-code entries allowed per code before it's dead (1–5; default 3). */
  maxAttempts?: number;
  /** Code field style: 'segmented' boxes (default) or a plain 'text' input. */
  inputStyle?: OtpInputStyle;
  /** Offered delivery channels (default ['sms']). */
  channels?: Array<'sms' | 'whatsapp'>;
  /** Default dial-code country for the phone input (falls back to the flow's country). */
  defaultCountry?: string;
}

// ---------------------------------------------------------------------------
// Extra-info questionnaire (compliance declarations)
// ---------------------------------------------------------------------------

export interface QuestionnaireFieldOption {
  value: string;
  label: string;
}

export interface QuestionnaireField {
  /** Stable snake_case key — also the webhook/decisioning field name. */
  key: string;
  label: string;
  /**
   * 'money' = amount + currency. The answer stores `<key>` (number, 2dp) and
   * a `<key>_currency` companion (ISO code).
   */
  type: 'text' | 'number' | 'money' | 'select' | 'multiselect' | 'boolean' | 'date';
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: QuestionnaireFieldOption[];
  min?: number;
  max?: number;
  /** money only: allowed ISO currency codes; the first is the default. */
  currencies?: string[];
}

export interface QuestionnaireConfig {
  /** Off switch for the step. Omitted/true = shown; false = skipped even though
   *  the questions remain configured (the builder's Questionnaire toggle). */
  enabled?: boolean;
  title?: string;
  description?: string;
  fields: QuestionnaireField[];
}

export type QuestionnaireAnswerValue = string | number | boolean | string[];

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

export interface MyazaKYCConfig<C extends AnyCountry = AnyCountry> {
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

  /**
   * Run the SDK from a **published Workflow** built in the Myaza
   * dashboard (`wf_…`). The SDK fetches the workflow’s configuration from the
   * server and uses it as the source of truth: **workflow config wins over any
   * overlapping props** (country, idTypes, step toggles, appearance, copy).
   * Runtime data — `userId`, `userData`, `metadata`, callbacks — always comes
   * from your code. With a `workflowId`, `country` becomes optional.
   *
   * An unknown/unpublished flow surfaces as a blocking `invalid_workflow` error
   * (via {@link onError} and the modal), never a silently different flow.
   */
  workflowId?: string;

  /**
   * Two-letter (ISO-2) country code. Required unless {@link workflowId} is set
   * (the flow carries the country) or {@link subjectType} is `'business'` (the
   * business block carries its own registry country). When both are present the
   * flow's country wins. ANY ISO country works — non-curated countries render
   * their ID types from the server's metadata (Global Documents); the org's
   * grants are enforced server-side.
   */
  country?: C;

  /**
   * What the flow verifies: an individual (KYC — the default) or a business
   * (KYB registry lookup). Normally supplied by a resolved workflow, not
   * hand-written: **live business submissions require a published KYB
   * workflow** (the server rejects them otherwise). Setting it as a prop is
   * supported for the dashboard builder's live preview (`previewMode`), where
   * submissions are mocked.
   */
  subjectType?: import('./business').SubjectType;

  /**
   * Business (KYB) subject configuration — the registry country, offered
   * products, and whether the registered business name is required. Like
   * {@link subjectType}, this normally rides a resolved workflow config.
   */
  business?: import('./business').WorkflowBusinessConfig;

  /**
   * Multi-region configuration. When more than one country is listed the flow
   * opens with a country-select step; the picked country's `idTypes` override
   * the root {@link idTypes} list. `country` acts as the default/primary.
   * Typically supplied by a dashboard-built Workflow rather than hand-written.
   */
  countries?: Array<{ country: AnyCountry; idTypes?: AnyIdType[] }>;

  /** Subset of ID types to offer. Only types valid for the given country are accepted. */
  idTypes?: IdTypeForCountry<C>[];

  /**
   * The org's own reference for the person being verified (e.g. your internal
   * user id). It is **not** matched during verification — it becomes
   * `Entity.externalUserId` at the KYC seam, so repeat checks of the same user
   * collapse onto one entity and you can correlate results back to your record.
   * Optional; when omitted the server falls back to the provider record id.
   */
  userId?: string;

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

  /**
   * How Presence Intelligence verifies liveness when the selfie step runs:
   * `'gestures'` (default) — randomized gesture challenges; `'flash'` — the
   * screen emits a random color sequence and the face's reflection is verified
   * (fast, hold-still, defeats replays/injection); `'both'` — gestures then
   * flash (strongest). Usually configured in the workflow builder.
   */
  livenessMode?: 'gestures' | 'flash' | 'both';

  /**
   * Device Intelligence — device + IP fraud analysis (multi-accounting,
   * emulator, datacenter-IP, velocity). On by default and billed per
   * verification; `false` disables the analysis, its charge, and the SDK's
   * fingerprint collection. Normally set by the workflow builder.
   */
  deviceIntelligence?: boolean;

  /** Show a light/dark mode toggle button inside the modal header. Default `true`. */
  showThemeToggle?: boolean;

  /**
   * Force the flow to render full screen on EVERY device. Desktop drops the
   * centered modal for the fullscreen layout and the expand/collapse button
   * is hidden (mobile is always fullscreen). Default `false`.
   */
  fullScreen?: boolean;

  /**
   * Offer "continue on your phone" device handoff. On **desktop**, before the
   * flow starts, the SDK shows a screen with a QR code + copyable link/code so
   * the user can finish on their phone (useful when the desktop has no webcam),
   * plus a "Continue on this device" CTA. When the phone submits, the desktop
   * auto-advances and fires {@link onSubmit}. Mobile devices skip the screen and
   * start the flow directly. Default `true`; set `false` to disable entirely.
   */
  deviceHandoff?: boolean;

  /**
   * Hide the close (X) button and block all user-initiated dismissal of the
   * modal — backdrop tap, Escape key, and (on mobile) swipe-down. When `true`,
   * the flow can only be closed programmatically via the `close()` returned by
   * {@link useMyazaKYC}. Default `false`. The terminal "Submitted" step is
   * already non-dismissible regardless of this flag.
   */
  disableClose?: boolean;

  /**
   * Open the verification modal immediately on mount instead of waiting for
   * the trigger button click (the button is not rendered). Used by embedded
   * preview surfaces (e.g. the dashboard flow builder); pairs naturally with
   * `deviceHandoff={false}`. Default `false`.
   */
  defaultOpen?: boolean;

  /**
   * Preview/mock mode (dashboard workflow builder). All WRITES are stubbed in
   * the browser: document photos, selfies, and liveness videos are never
   * uploaded and no verification is ever created — walking the flow is free of
   * side effects. Read-only calls (config, workflow resolution) still hit the
   * server so the preview reflects real grants + branding. Default `false`.
   */
  previewMode?: boolean;

  /**
   * Imperatively show a specific step (dashboard workflow builder: clicking a
   * step in the rail jumps the preview there). Prerequisite state (an ID type
   * of the right kind) is seeded automatically so mid-flow steps render.
   * Ignored when unset.
   */
  previewStep?: KYCStep | null;

  /** Visual customisation */
  appearance?: KYCAppearance;

  /** Override the consent (welcome) screen copy. */
  consent?: KYCConsentContent;

  /** Override the success (submitted) screen copy. */
  success?: KYCSuccessContent;

  /**
   * Extra-info questionnaire shown after capture, right before submission —
   * compliance declarations like income, source of funds, expected volume.
   * Usually configured in the dashboard workflow builder (rides `workflowId`);
   * answers are validated server-side against the published definition and
   * delivered in `data.questionnaire` on verification webhooks.
   */
  questionnaire?: QuestionnaireConfig;

  /**
   * Email Verification: an in-flow OTP possession check right after consent.
   * The user enters their email, receives a code, and types it in; the
   * verified contact + signals (disposable domain, free provider) are
   * delivered in `data.emailVerification` on verification webhooks and are
   * branchable in workflow decisioning (`email.*`). Usually configured in the
   * workflow builder (rides `workflowId`).
   */
  emailVerification?: EmailVerificationConfig;

  /**
   * Phone Verification: an in-flow OTP possession check (SMS/WhatsApp) right
   * after consent. Delivered in `data.phoneVerification` on webhooks and
   * branchable in decisioning (`phone.*`). Usually configured in the workflow
   * builder (rides `workflowId`).
   */
  phoneVerification?: PhoneVerificationConfig;

  /**
   * Proof of Address: collect a PoA document (utility bill, bank statement,
   * tenancy) after capture. The server reads it (Document AI), checks the name
   * against the verified subject + a recency window, and delivers the result
   * in `data.proofOfAddress` on verification webhooks — it never changes the
   * verification's own status. Usually configured in the workflow builder.
   */
  proofOfAddress?: ProofOfAddressConfig;

  /**
   * NFC Chip Verification: read the ID's eMRTD chip (e-passports & chip eIDs)
   * and run passive authentication server-side. Native (mobile) SDKs implement
   * the real chip read; the web SDK renders the screen only for the builder
   * preview (browsers can't do ISO-DEP). Usually configured in the workflow
   * builder (rides `workflowId`).
   */
  nfc?: NfcConfig;

  /**
   * Base path (or absolute URL) where the SDK's gesture GIF assets are served
   * from. These are used by the liveness step to animate each challenge gesture.
   *
   * - Set to an **absolute URL** (e.g. `'https://cdn.example.com/kyc-assets'`)
   *   to serve from a CDN — requires no files in your `public/` folder.
   * - Set to a **relative path** (e.g. `'/kyc-assets'`) to serve locally; copy
   *   the `gifs/` folder from `node_modules/@myazahq/kyc-sdk-react/gifs/` to
   *   that path in your public directory.
   *
   * Defaults to `'/kyc-assets'`.
   */
  assetsBasePath?: string;

  /**
   * Arbitrary, free-form metadata forwarded verbatim with every verification
   * request. Nothing here is required or interpreted by the SDK/server — use
   * {@link userId} for the user reference, not a `userId` key in here.
   */
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
export type MyazaKYCProps<C extends AnyCountry = AnyCountry> =
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
