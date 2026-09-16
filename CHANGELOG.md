# Changelog

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
