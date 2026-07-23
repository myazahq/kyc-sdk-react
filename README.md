# @myazahq/kyc-sdk-react

React component library for Myaza KYC — drop-in identity verification (ID capture, document scan, and active liveness) that talks to the Myaza KYC API.

## Installation

```bash
pnpm add @myazahq/kyc-sdk-react
```

```bash
yarn add @myazahq/kyc-sdk-react
```

```bash
npm install @myazahq/kyc-sdk-react
```

## Usage

`<MyazaKYC />` renders a "Verify Identity" button plus the full modal flow. The trigger is a real `<button>` — pass `children` to relabel it, `className` to restyle it, or any other button attribute (`disabled`, `type`, `aria-*`, …). See [Trigger button](#trigger-button). Import the bundled stylesheet once, anywhere in your app.

```tsx
"use client";

import { MyazaKYC } from "@myazahq/kyc-sdk-react";
import "@myazahq/kyc-sdk-react/styles.css";

export default function VerifyButton() {
	return (
		<MyazaKYC
			apiKey='pk_live_xxx'
			country='NG'
			idTypes={["passport", "drivers-license", "bvn", "nin", "pvc"]}
			userData={{ firstName: "Jane", lastName: "Doe" }}
			enableSelfie={true}
			enableDocumentCapture={true}
			enableLiveness={true}
			showThemeToggle={true}
			appearance={{
				primaryColor: "#5645F5",
				companyName: "Myaza",
				logo: "default",
				theme: "dark",
			}}
			consent={{
				title: "Welcome, {firstName}",
				description: "A quick check to confirm it's really you.",
			}}
			success={{
				title: "You're all set, {firstName}!",
				description: "We'll email you once your verification is reviewed.",
			}}
			metadata={{ userId: "test_user_123" }}
			onStart={() => console.log("KYC started")}
			onStepChange={(step) => console.log("Step:", step)}
			onSubmit={(submission) => {
				// Fires as soon as the server accepts the request.
				// submission.status is always 'pending' — the result arrives later via
				// webhook to your backend (or poll GET /api/kyc/status/:id).
				console.log("Submitted!", submission.verificationId);
			}}
			onClose={() => console.log("Modal closed")}
			onError={(err) => console.error("SDK error:", err)}
		/>
	);
}
```

## Props

| Prop                    | Type                                      | Default             | Description                                                                                                          |
| ----------------------- | ----------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `apiKey`                | `string`                                  | —                   | **Required.** Sent as `Authorization: Bearer`. The **environment is derived from the key prefix** (`pk_test_…` → sandbox, `pk_live_…` → production); an unrecognized prefix throws. |
| `country`               | `'NG' \| 'GH' \| 'KE' \| 'ZA' \| 'CI'`    | —                   | **Required.** Country whose ID types are offered.                                                                    |
| `idTypes`               | `IdType[]`                                | all allowed for org | Subset of ID types to offer; must be valid for `country`.                                                            |
| `userData`              | `{ firstName?, lastName?, dateOfBirth? }` | —                   | Pre-fills the user's details.                                                                                        |
| `enableSelfie`          | `boolean`                                 | `true`              | Capture a selfie during liveness.                                                                                    |
| `enableDocumentCapture` | `boolean`                                 | `true`              | Enable the document-scan step for document IDs.                                                                      |
| `allowDocumentUpload`   | `boolean`                                 | `true`              | Allow picking a document photo from the device (gallery / drag-and-drop) as an alternative to the camera. `false` hides every "upload instead" affordance (it's still offered on the camera-permission-denied screen as an escape hatch). |
| `enableLiveness`        | `boolean`                                 | `true`              | Run the liveness challenge step. The server can still disable it per ID type.                                        |
| `voiceGuidance`         | `boolean \| { enabled?, language? }`      | `true`              | Spoken liveness instructions (accessibility, TTS **output** — no microphone). `false` mutes it; pass `{ language: 'fr-FR' }` to set the voice. See [Robustness & error handling](#robustness--error-handling). |
| `showThemeToggle`       | `boolean`                                 | `false`             | Show a light/dark toggle inside the modal.                                                                           |
| `deviceHandoff`         | `boolean`                                 | `true`              | On desktop, show a "continue on your phone" screen (QR + copyable link) before the flow starts — handy when the computer has no webcam. The user can still choose to continue on the current device, and when they finish on their phone the desktop completes automatically. Set `false` to disable. Has no effect on mobile/touch devices. |
| `appearance`            | `KYCAppearance`                           | brand defaults      | Brand & theme the modal — colors, logo, light/dark. See [Appearance & theming](#appearance--theming).                |
| `consent`               | `KYCConsentContent`                       | built-in copy       | Override the consent/welcome screen `title` and `description`. See [Consent screen copy](#consent-screen-copy).      |
| `success`               | `KYCSuccessContent`                       | built-in copy       | Override the success/submitted screen `title` and `description`. See [Success screen copy](#success-screen-copy).    |
| `metadata`              | `Record<string, string>`                  | —                   | Forwarded with every verify request.                                                                                 |
| `onStart`               | `() => void`                              | —                   | Called when the flow opens.                                                                                          |
| `onStepChange`          | `(step: KYCStep) => void`                 | —                   | Called on each step transition.                                                                                      |
| `onSubmit`              | `(submission: KYCSubmission) => void`     | —                   | Called when the server accepts the verification. `status` is always `'pending'`.                                     |
| `onError`               | `(error: KYCError) => void`               | —                   | Called for **technical** errors only. Receives a typed [`KYCError`](#robustness--error-handling) (a real `Error` with a `code`). Verification outcomes never come through here. |
| `onClose`               | `() => void`                              | —                   | Called when the user closes the flow.                                                                                |
| `children`              | `ReactNode`                               | `Verify Identity`   | Trigger button label/content. Defaults to `Verify with {companyName}` when `companyName` is set, else `Verify Identity`. |
| `className`             | `string`                                  | —                   | Trigger button classes. Merged via `tailwind-merge`, so your classes override the built-in styling.                  |
| _other button attrs_    | `ButtonHTMLAttributes`                    | —                   | Any standard `<button>` attribute (`disabled`, `type`, `aria-*`, `style`, …) is forwarded. `onClick` is reserved by the SDK. |

## Environment

There is **no `environment` prop** — the SDK derives the environment (and the
base URL) from the API key prefix, which is the single source of truth:

| Key prefix | Environment | Base URL |
|---|---|---|
| `pk_test_…` / `sk_test_…` | sandbox | `https://trust.myaza.app` |
| `pk_live_…` / `sk_live_…` | production | `https://trust.myaza.app` |

An unrecognized or malformed key throws at setup (it never silently defaults).

## Trigger button

`<MyazaKYC />` renders a real `<button>`. Beyond the config props above it accepts standard button attributes (the props type is exported as `MyazaKYCProps`), so you can treat it like any other button:

```tsx
<MyazaKYC
  {...config}
  className="w-full rounded-full bg-black px-6 text-white"
  disabled={!ready}
>
  Start verification
</MyazaKYC>
```

- `children` sets the label (falls back to `Verify with {companyName}` / `Verify Identity`).
- `className` is merged through `tailwind-merge`, so your classes win over the defaults.
- `style` is merged on top of the SDK's injected theme variables, so theming still applies.
- `onClick` is **owned by the SDK** (it opens the modal) and can't be overridden. For a fully custom trigger element, use the `useMyazaKYC()` hook and wire its `open()` to your own component.

## Appearance & theming

Pass an `appearance` object to brand the flow. Colors are injected as CSS variables **scoped to the SDK** — they never leak into your page's styles. Because the UI is token-driven, setting one color cascades to all of its shades (hover/selected/focus states included).

| Field              | Type                | Description                                                                      |
| ------------------ | ------------------- | -------------------------------------------------------------------------------- |
| `primaryColor`     | `string`            | Brand color — buttons, selected states, focus rings. Defaults to `#5645F5`.      |
| `primaryTextColor` | `string`            | Text/icons rendered on top of `primaryColor` (e.g. button labels).               |
| `accentColor`      | `string`            | Subtle hover/active surfaces.                                                    |
| `backgroundColor`  | `string`            | Modal background.                                                                |
| `surfaceColor`     | `string`            | Cards & panels.                                                                  |
| `borderColor`      | `string`            | Borders and input outlines.                                                      |
| `textColor`        | `string`            | Primary text color.                                                              |
| `companyName`      | `string`            | Used on the verify button (“Verify with …”) and the persistent header.           |
| `logo`             | `string`            | Image URL, or `'default'` to use your org's logo. See below.                     |
| `theme`            | `'light' \| 'dark'` | Initial mode (defaults to `'light'`). With `showThemeToggle`, users can flip it. |

### Logo

The org logo renders as a small circular avatar in the modal header (top-left), persistent on every step, alongside `companyName`.

- `logo: 'https://…/logo.png'` — uses that image directly.
- `logo: 'default'` — pulls your organization's logo configured in the **Myaza dashboard** (returned by the server on mount). If your org has no logo set, or the image fails to load, it falls back to a built-in shield icon.
- omitted — no header logo.

```tsx
appearance={{
  primaryColor: "#0F7B6C",
  primaryTextColor: "#FFFFFF",
  surfaceColor: "#F4F7F6",
  borderColor: "#D7E3E0",
  logo: "default",
  theme: "light",
}}
```

## Consent screen copy

The welcome/consent step shows a heading and a short description. Override either through the `consent` prop:

| Field         | Type     | Description                                                                                           |
| ------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `title`       | `string` | Heading. Defaults to `Welcome, {firstName}` when a first name is known, else `Identity Verification`. |
| `description` | `string` | Sub-text under the heading. Defaults to the built-in regulatory copy.                                 |

Both fields support `{firstName}` and `{lastName}` tokens, replaced with the values from `userData` (empty string when absent), so a custom title can still greet the user by name.

```tsx
consent={{
  title: "Welcome, {firstName}",
  description: "We just need to confirm it's really you. This takes about a minute.",
}}
```

## Success screen copy

After the user submits, the final screen shows a confirmation heading and description. Override either through the `success` prop:

| Field         | Type     | Description                                                                |
| ------------- | -------- | -------------------------------------------------------------------------- |
| `title`       | `string` | Heading. Defaults to `Verification Submitted!`.                            |
| `description` | `string` | Sub-text under the heading. Defaults to the built-in "submitted for review" copy. |

Both fields support the same `{firstName}` / `{lastName}` tokens as `consent`, replaced with the values from `userData` (empty string when absent).

```tsx
success={{
  title: "You're all set, {firstName}!",
  description: "We'll email you once your verification is reviewed.",
}}
```

## Robustness & error handling

The SDK is resilient to flaky networks, denied permissions, and poor capture
conditions, and reports technical failures through `onError` with a typed code.

### Typed errors (`onError`)

`onError` receives a `KYCError` — a real `Error` (so existing `(error: Error)`
handlers still work) that also carries a typed `code` and optional `details`.
The codes are **identical to the Flutter SDK**:

```ts
import { MyazaKYC, KYCError } from "@myazahq/kyc-sdk-react";

<MyazaKYC
  {...config}
  onError={(error: KYCError) => {
    switch (error.code) {
      case "camera_permission_denied": /* ask the user to allow the camera */ break;
      case "insufficient_credits":     /* error.details = { required, balance, currency } */ break;
      case "network_error":
      case "upload_failed":            /* shown only after automatic retries */ break;
    }
  }}
/>
```

| `code`                     | When it fires                                                        |
| -------------------------- | ------------------------------------------------------------------- |
| `network_error`            | Connection failure / timeout, **after retries are exhausted**.      |
| `invalid_api_key`          | Server returned `401`.                                              |
| `insufficient_credits`     | Server returned `402`. `details = { required, balance, currency }`. |
| `upload_failed`            | A media upload failed, **after retries are exhausted**.            |
| `camera_permission_denied` | The user denied (or the OS/browser blocks) camera access.          |
| `feature_disabled`         | Server returned `403` (ID type / feature not enabled for the org). |
| `unknown`                  | Anything else.                                                      |

> Voice guidance is TTS **output** — it never records audio, so there is **no
> microphone permission** and no microphone error code.

### Network resilience

Media uploads and the verify submission are wrapped in exponential-backoff retry
(with jitter), retrying only *transient* failures (network / timeout / `5xx`);
terminal `4xx` surface immediately. The UI shows "Reconnecting… / retrying
(n/3)…" between attempts, and `onError` fires **only after retries are
exhausted** (`upload_failed` for uploads, `network_error` for connectivity).

### Camera permission

If the user denies camera access, the SDK shows a clear "camera access needed"
screen (with how to re-enable it) instead of hanging, and reports
`camera_permission_denied` to `onError`. Document capture additionally offers a
gallery-upload fallback unless `allowDocumentUpload` is `false`.

### Liveness quality guards

- **Multiple faces** — if more than one face is in frame, the challenge pauses
  ("Make sure only your face is visible") and resumes automatically when only
  one face remains. This guards capture quality and a class of spoofing.
- **Lighting** — too-dark *and* too-bright (glare) conditions are detected live
  during liveness and document capture; the SDK shows guidance ("Move to a
  brighter area" / "Too bright — reduce glare") and discourages auto-capture
  until lighting is acceptable.

## Documentation

Full documentation, configuration options, and webhook setup: **[trust.myaza.co/documentation/sdks](https://trust.myaza.co/documentation/sdks)**.
