import type { CompletedSessionSummary, HandoffBootstrapResponse } from '../services/api';
import type { KYCStep } from '../types/config';
import type { KYCError, KYCSubmission } from '../types/verification';

// The hosted entry point's public props, split out of MyazaKYCHosted.tsx
// (200-line rule). Re-exported from there, so the public surface is unchanged.

/** What a hosted flow knows about its session once it has bootstrapped. */
export interface MyazaKYCHostedReadyInfo {
  sessionId: string;
  environment: HandoffBootstrapResponse['environment'];
  subjectType?: string;
  scope?: string;
}

export interface MyazaKYCHostedProps {
  /**
   * The raw handoff session token from the hosted-page URL
   * (`/verify/<token>`). The SDK presents it as a `hs_<token>` bearer.
   */
  token: string;
  /**
   * Mount INSIDE a host application rather than on the hosted page. Implies
   * shadow-DOM style isolation (the SDK carries its own stylesheet; no global
   * `styles.css` import, and the host app's CSS cannot reach in), swaps the
   * full-page loading/terminal chrome for compact blocks that sit in a panel,
   * and makes the modal closable — the success screen's action becomes a real
   * Done button wired to {@link onClose}. The hosted page passes nothing and
   * keeps its full-page, light-DOM behaviour exactly as before.
   */
  embedded?: boolean;
  /** Embedded mounts: the modal was closed or the flow's Done was pressed. */
  onClose?: () => void;
  /**
   * The hosted page's lifecycle, for a HOST that wants to listen — the hosted
   * page forwards these to a native WebView or an embedding iframe. Mirrors
   * `<MyazaKYC/>`'s callbacks; `onReady` and `onCompleted` are hosted-only.
   * Everything they carry is PII-light: ids, step names, error codes.
   */
  onReady?: (info: MyazaKYCHostedReadyInfo) => void;
  onStart?: () => void;
  onStepChange?: (step: KYCStep) => void;
  onSubmit?: (submission: KYCSubmission) => void;
  onError?: (error: KYCError) => void;
  /** A returning applicant opened a link whose verification was already submitted. */
  onCompleted?: (summary: CompletedSessionSummary | null) => void;
}
