'use client';

import React from 'react';
import { FlaskConical } from 'lucide-react';

import { useKYCConfig } from '../context/KYCConfigContext';

/**
 * "You are not in production" strip, shown above the modal chrome.
 *
 * A sandbox flow is pixel-identical to a live one, which is the point — you are
 * testing the real thing — and also the hazard: screenshots get mistaken for
 * production incidents, testers wonder why a real passport was rejected, and a
 * `pk_test_` key shipped to production looks like it works right up until
 * nobody is actually verified. One always-visible strip removes the ambiguity.
 *
 * Environment comes from the SERVER (`/config`), not the API key prefix. Hosted
 * sessions authenticate with an `hs_` handoff token that carries no environment
 * slot, so key-sniffing would leave exactly the surface an end user sees
 * unlabelled.
 *
 * DEVELOPMENT is labelled too, and differently: it runs the real pipeline
 * against staging provider credentials, so "test data only" would be a lie
 * there — a dev key with a real ID does make real calls.
 */
export function SandboxBanner() {
  const { serverConfig } = useKYCConfig();
  const env = serverConfig.environment;
  if (env !== 'SANDBOX' && env !== 'DEVELOPMENT') return null;

  const sandbox = env === 'SANDBOX';

  return (
    <div
      // Amber, not the brand colour: this is an out-of-band status about the
      // session itself, and painting it in the org's palette would read as part
      // of their flow. Not `destructive` either — nothing is wrong.
      className="flex shrink-0 items-center justify-center gap-2 bg-amber-500/15 px-4 py-1.5 text-center"
      role="status"
    >
      <FlaskConical className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
        {sandbox ? 'Sandbox' : 'Development'}
      </span>
      <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
        {sandbox ? 'Test data only, no real checks run' : 'Test environment, results are not live'}
      </span>
    </div>
  );
}
