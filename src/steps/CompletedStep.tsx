'use client';

import React from 'react';
import { useKYCConfig } from '../context/KYCConfigContext';
import { KeyPeopleAwaitList, type AwaitRow } from './KeyPeopleAwaitList';
import { SubmitSuccessScreen, type TerminalTone } from './SubmittedScreens';
import { successAction, successDescription, successTitle } from './success-copy';
import { configScope } from '../lib/scope';
import { PresenceExpectations } from './presence-expectations';
import type { AwaitingPersonPayload, CompletedSessionSummary } from '../services/api';

// The success screen as an applicant sees it when they come BACK to their link.
//
// It is the same screen SubmittedStep renders, not a look-alike: same copy, same
// people list, same terminal affordance. What differs is where the rows come
// from. Nothing the applicant typed survives the tab closing, so the server
// rebuilds them — which is also what makes the statuses live, since the people
// named here go and verify long after the screen was first shown.
//
// It never submits anything. That is the whole reason it is a separate
// component from SubmittedStep, which submits on mount.

/** Ownership as the list renders it: a whole number where that is honest. */
function formatPct(pct: number | null): string | null {
  if (pct === null || !Number.isFinite(pct)) return null;
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/\.?0+$/, '');
}

export function toAwaitRows(people: AwaitingPersonPayload[]): AwaitRow[] {
  return people.map((p) => ({
    name: p.name,
    role: p.role,
    pct: formatPct(p.ownershipPct),
    country: p.country,
    status: p.status,
    ...(p.inviteUrl ? { inviteUrl: p.inviteUrl } : {}),
    isApplicant: p.isApplicant,
    isCorporate: p.isCorporate ?? false,
  }));
}

/**
 * What a decided application says instead of the submission copy.
 *
 * Only the outcomes that CHANGE the message appear here. `submitted` is absent
 * on purpose: nothing has been decided, so the org's own success copy is still
 * the right thing to show and overriding it would be a downgrade.
 */
const OUTCOME_COPY: Partial<
  Record<
    NonNullable<CompletedSessionSummary['outcome']>,
    { tone: TerminalTone; title: string; description: string }
  >
> = {
  approved: {
    tone: 'success',
    title: 'Verification complete',
    description: 'This business has been verified. There is nothing left to do here.',
  },
  declined: {
    tone: 'declined',
    title: 'Verification unsuccessful',
    description:
      'This business could not be verified. Contact the organisation that sent you this link to find out what happens next.',
  },
  action_needed: {
    tone: 'neutral',
    title: 'More information needed',
    description:
      'Some details need to be provided again. The organisation that sent you this link will have shared a new link to continue.',
  },
  // Ours, not theirs, so it says so rather than reading as a rejection.
  error: {
    tone: 'neutral',
    title: 'Something went wrong on our side',
    description:
      'This verification could not be completed because of a problem at our end. Nothing was charged. Contact the organisation that sent you this link.',
  },
};

export function CompletedStep() {
  const config = useKYCConfig();
  const summary = config.completedSummary;

  const isBusiness = summary?.subjectType === 'business';
  const tokens = {
    firstName: config.userData?.firstName,
    lastName: config.userData?.lastName,
    // The register's name for the company, which is what it was verified as.
    businessName: summary?.businessName ?? config.userData?.businessName,
  };
  const rows = summary ? toAwaitRows(summary.keyPeople) : [];

  // WHAT HAPPENED, not merely that it was sent.
  //
  // Absent on an older server, which only ever reported the submission, so the
  // default keeps that behaviour rather than inventing a verdict.
  const outcome = summary?.outcome ?? 'submitted';
  const decided = OUTCOME_COPY[outcome];

  return (
    <SubmitSuccessScreen
      tone={decided?.tone ?? 'success'}
      title={decided ? decided.title : successTitle(config.success, tokens)}
      description={
        decided
          ? // The server's own reason where there is one: it is user-safe prose
            // by contract, and `business_not_found` telling somebody to check
            // the registration number is the most useful thing this screen can
            // say. The generic line is the fallback, never a replacement.
            summary?.reason || decided.description
          : successDescription(config.success, tokens, isBusiness, configScope(config))
      }
      extra={
        <>
          {/* The presence card, exactly as the live success screen shows it —
              a reloaded finished link must not lose the one instruction that
              still applies (keep location on). Only on a success-ish outcome
              and only when the submission really carried a pin. */}
          {(!decided || decided.tone === 'success') &&
            config.addressCollection?.presence?.enabled === true &&
            summary?.addressCollected === true && <PresenceExpectations />}
          {rows.length > 0 && <KeyPeopleAwaitList rows={rows} />}
        </>
      }
      action={successAction({
        success: config.success,
        hostedMode: config.hostedMode === true,
        tokens,
        onClose: () => config.onClose?.(),
      })}
    />
  );
}
