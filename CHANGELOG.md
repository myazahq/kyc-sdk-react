# Changelog

## 3.1.0

### Supporting documents

A new step collects the artefacts an organisation holds **on file** — a NIN slip,
a signed mandate, a bank letter — as opposed to the identity evidence the
verification is decided on. It sits after the identity checks and before proof of
address, because the documents are resolved against the ID the person actually
verified with.

There is no catalogue. The organisation names each document it asks for, so the
SDK renders the title and guidance the workflow sent rather than captioning a key
it recognises. A document with no title is not asked for at all.

Entirely workflow-driven (`supportingDocuments` on the resolved config), so no
props change and an existing integration needs no code edit to receive it.

- One card per requested document, naming **what the document is being taken
  for**: the values the server will read off it appear as chips under the
  guidance, so a slot says more than a noun.
- Per-document **ID scoping**. A document scoped to `NG/nin` is never demanded of
  a passport holder, which is what stops the step being a dead end.
- **`alwaysAsk`** shows the slot to everyone while the scope decides only who
  must provide one, for an organisation that will take a document from anybody
  who has it.
- Where nothing is required, Continue reads **Skip**: pressing on is a deliberate
  choice to add nothing.

### Fixes

- An address flow that verifies by document alone no longer opens a map, and its
  consent notice no longer promises one it never shows.
- A flow with nothing to capture is no longer offered a phone handoff.
- Choosing to verify on this device now gives the handoff session back instead of
  leaving it open.

## 3.0.0

### Face re-authentication has one entry point (breaking)

`MyazaBiometricAuth` and its `MyazaBiometricAuthProps` type are **removed** from
the package's exports.

Face re-authentication now runs through the ordinary entry point. Mount
`<MyazaKYC/>` with a workflow whose scope is `biometric-authentication`, and the
flow parks on the real liveness step and submits to `/verify` under that scope's
marker ID type, exactly as every other scoped workflow does:

```tsx
<MyazaKYC
  apiKey={apiKey}
  workflowId="wf_…"     // a workflow scoped to biometric-authentication
  userId={userId}       // the enrolled entity's reference
  onResult={handleResult}
  onError={handleError}
/>
```

If you imported `MyazaBiometricAuth`, replace it with the mount above. Nothing
else changes: the same check runs, against the same enrolment reference, and
returns the same verdict.

**Why it went rather than being deprecated.** A second component meant two code
paths for one behaviour, and that is how the two drift — a fix or a copy change
lands in one and not the other. Keeping a deprecated shim would have preserved
exactly the duplication the change exists to remove. Nobody had integrated the
component, so an outright removal costs less than a shim nobody needs.

The `/api/kyc/biometric/*` endpoints are unaffected and remain available for
direct server-to-server integration. No SDK calls them.

### Version alignment

The web, React Native and Flutter SDKs now all carry **3.0.0** for the same
release, so a given version number means the same generation of the product on
every platform.
