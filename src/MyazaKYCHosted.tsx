'use client';

import React, { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { buildThemeVars } from './lib/theme';
import { createKYCApi, type CompletedSessionSummary, type HandoffBootstrapResponse, type KYCApi } from './services/api';
import { HostedCompleted } from './hosted/HostedCompleted';
import { HostedFlow } from './hosted/HostedFlow';
import { HANDOFF_TOKEN_PREFIX } from './hosted/token';
import { SdkFrame } from './lib/sdk-frame';

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
}

/**
 * Hosted "continue on your phone" entry point. Rendered by the Myaza-hosted
 * verification page (`/verify/<token>`), NOT by customers directly. It bootstraps
 * the flow from the session token and runs the SAME steps as `<MyazaKYC />`,
 * authenticating every upload/verify with the session token (relative base URL,
 * so requests go through the hosting origin's API proxy).
 */
export function MyazaKYCHosted({ token, embedded = false, onClose }: MyazaKYCHostedProps) {
  // Relative base ('') → requests hit the hosting origin and its /api proxy.
  const [api] = useState<KYCApi>(() => createKYCApi('', `${HANDOFF_TOKEN_PREFIX}${token}`));
  const [phase, setPhase] = useState<'loading' | 'ready' | 'completed' | 'error'>('loading');
  const [bootstrap, setBootstrap] = useState<HandoffBootstrapResponse | null>(null);
  const [summary, setSummary] = useState<CompletedSessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .bootstrapHandoff(token)
      .then((data) => {
        if (cancelled) return;
        setBootstrap(data);
        setPhase('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Already submitted is the person who FINISHED coming back to their own
        // link. Telling them it is unavailable reads as though their
        // application was lost, which is the opposite of what happened. Rebuild
        // the success screen instead — for a KYB applicant it is where their
        // directors' verification links live, and those outlive the session.
        if (
          err !== null &&
          typeof err === 'object' &&
          (err as { code?: string }).code === 'handoff_session_used'
        ) {
          api
            .completedSession(token)
            .then((data) => {
              if (cancelled) return;
              setSummary(data);
              setPhase('completed');
            })
            .catch(() => {
              // The summary is an enrichment, not the message. Falling back to
              // the plain confirmation still tells them the true thing.
              if (!cancelled) setPhase('completed');
            });
          return;
        }
        setError(err instanceof Error ? err.message : 'This verification link is no longer valid.');
        setPhase('error');
      });
    return () => {
      cancelled = true;
    };
  }, [api, token]);

  const frame = (body: React.ReactNode) => <SdkFrame isolate={embedded}>{body}</SdkFrame>;

  if (phase === 'loading') {
    return frame(
      <CenteredScreen compact={embedded}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your verification…</p>
      </CenteredScreen>,
    );
  }

  // Somebody returning should land on the screen they left — the real one, with
  // the org's branding, its success copy, and (for KYB) the people the review is
  // still waiting on, each with a link to copy and a live status. Embedded
  // mounts get the SAME screen as a closable modal: a submitted application's
  // key-people invite links live here, and the applicant's job is not finished
  // until those people verify.
  if (phase === 'completed' && summary) {
    const done = (
      <HostedCompleted token={token} api={api} summary={summary} embedded={embedded} onClose={onClose} />
    );
    return embedded ? frame(done) : done;
  }

  // Only when the summary could not be loaded. The confirmation is still true;
  // it is the people list that is missing.
  if (phase === 'completed') {
    return frame(
      <CenteredScreen compact={embedded}>
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
          <Check className="h-10 w-10 text-emerald-500" />
        </span>
        <h1 className="text-lg font-semibold font-heading">Verification submitted</h1>
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          This has already been sent for review. There is nothing more for you to do{embedded ? '.' : ', and you can close this tab.'}
        </p>
      </CenteredScreen>,
    );
  }

  if (phase === 'error' || !bootstrap) {
    return frame(
      <CenteredScreen compact={embedded}>
        <h1 className="text-lg font-semibold font-heading">Link unavailable</h1>
        <p className="max-w-xs text-center text-sm text-muted-foreground">
          {error ?? 'This verification link has expired or already been used. Return to your computer to start again.'}
        </p>
      </CenteredScreen>,
    );
  }

  return frame(<HostedFlow token={token} api={api} bootstrap={bootstrap} embedded={embedded} onClose={onClose} />);
}

function CenteredScreen({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
  // Compact: an embedded mount sits inside a host panel, where a
  // min-h-screen block would blow the layout open.
  return (
    <div
      className={
        compact
          ? 'kyc-root flex flex-col items-center justify-center gap-4 rounded-2xl bg-background px-6 py-12 text-foreground'
          : 'kyc-root flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-foreground'
      }
      style={buildThemeVars(undefined)}
    >
      {children}
    </div>
  );
}
