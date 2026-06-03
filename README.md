# @myazahq/kyc-sdk-react

React component library for Myaza KYC — drop-in identity verification (ID capture, document scan, and active liveness) that talks to the Myaza KYC API.

## Installation

```bash
npm install @myazahq/kyc-sdk-react
```

## Usage

`<MyazaKYC />` renders a "Verify Identity" button plus the full modal flow. Import the bundled stylesheet once, anywhere in your app.

```tsx
"use client";

import { MyazaKYC } from "@myazahq/kyc-sdk-react";
import "@myazahq/kyc-sdk-react/styles.css";

export default function VerifyButton() {
	return (
		<MyazaKYC
			environment='production'
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

| Prop                    | Type                                             | Default             | Description                                                                                                          |
| ----------------------- | ------------------------------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `apiKey`                | `string`                                         | —                   | **Required.** Sent as `Authorization: Bearer`. `pk_test_*` runs in sandbox, `pk_live_*` in production.               |
| `environment`           | `'staging' \| 'production'`                      | —                   | **Required.** Selects the API base URL the SDK talks to.                                                             |
| `country`               | `'NG' \| 'GH' \| 'KE' \| 'ZA' \| 'CI'`           | —                   | **Required.** Country whose ID types are offered.                                                                    |
| `idTypes`               | `IdType[]`                                       | all allowed for org | Subset of ID types to offer; must be valid for `country`.                                                            |
| `userData`              | `{ firstName?, lastName?, dateOfBirth? }`        | —                   | Pre-fills the user's details.                                                                                        |
| `enableSelfie`          | `boolean`                                        | `true`              | Capture a selfie during liveness.                                                                                    |
| `enableDocumentCapture` | `boolean`                                        | `true`              | Enable the document-scan step for document IDs.                                                                      |
| `enableLiveness`        | `boolean`                                        | `true`              | Run the liveness challenge step. The server can still disable it per ID type.                                        |
| `showThemeToggle`       | `boolean`                                        | `false`             | Show a light/dark toggle inside the modal.                                                                           |
| `appearance`            | `KYCAppearance`                                  | brand defaults      | Brand & theme the modal — colors, logo, light/dark. See [Appearance & theming](#appearance--theming).                |
| `consent`               | `KYCConsentContent`                              | built-in copy       | Override the consent/welcome screen `title` and `description`. See [Consent screen copy](#consent-screen-copy).       |
| `metadata`              | `Record<string, string>`                         | —                   | Forwarded with every verify request.                                                                                 |
| `onStart`               | `() => void`                                     | —                   | Called when the flow opens.                                                                                          |
| `onStepChange`          | `(step: KYCStep) => void`                        | —                   | Called on each step transition.                                                                                      |
| `onSubmit`              | `(submission: KYCSubmission) => void`            | —                   | Called when the server accepts the verification. `status` is always `'pending'`.                                     |
| `onError`               | `(error: Error) => void`                         | —                   | Called for **technical** errors only (network, `401`, `402`, upload). Verification outcomes never come through here. |
| `onClose`               | `() => void`                                     | —                   | Called when the user closes the flow.                                                                                |

## Appearance & theming

Pass an `appearance` object to brand the flow. Colors are injected as CSS variables **scoped to the SDK** — they never leak into your page's styles. Because the UI is token-driven, setting one color cascades to all of its shades (hover/selected/focus states included).

| Field              | Type                  | Description                                                                 |
| ------------------ | --------------------- | --------------------------------------------------------------------------- |
| `primaryColor`     | `string`              | Brand color — buttons, selected states, focus rings. Defaults to `#5645F5`. |
| `primaryTextColor` | `string`              | Text/icons rendered on top of `primaryColor` (e.g. button labels).          |
| `accentColor`      | `string`              | Subtle hover/active surfaces.                                               |
| `backgroundColor`  | `string`              | Modal background.                                                           |
| `surfaceColor`     | `string`              | Cards & panels.                                                             |
| `borderColor`      | `string`              | Borders and input outlines.                                                 |
| `textColor`        | `string`              | Primary text color.                                                         |
| `companyName`      | `string`              | Used on the verify button (“Verify with …”) and the persistent header.      |
| `logo`             | `string`              | Image URL, or `'default'` to use your org's logo. See below.                |
| `theme`            | `'light' \| 'dark'`   | Initial mode (defaults to `'light'`). With `showThemeToggle`, users can flip it. |

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

| Field         | Type     | Description                                                                                          |
| ------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `title`       | `string` | Heading. Defaults to `Welcome, {firstName}` when a first name is known, else `Identity Verification`. |
| `description` | `string` | Sub-text under the heading. Defaults to the built-in regulatory copy.                                |

Both fields support `{firstName}` and `{lastName}` tokens, replaced with the values from `userData` (empty string when absent), so a custom title can still greet the user by name.

```tsx
consent={{
  title: "Welcome, {firstName}",
  description: "We just need to confirm it's really you. This takes about a minute.",
}}
```

## Documentation

Full documentation, configuration options, and webhook setup: **[docs.myaza.co](https://docs.myaza.co)**.
