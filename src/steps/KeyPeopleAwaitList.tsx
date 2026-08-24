'use client';

import React, { useState } from 'react';
import { BadgeCheck, Building2, Check, Link2 } from 'lucide-react';
import { CountryFlag } from '../components/CountryFlag';
import { APPLICANT_ROLE_LABELS } from '../lib/business-application';
import { cn } from '../lib/utils';
import type { KeyPersonRole } from '../types/business';

// Presentational half of "Awaiting users" — the people section of the KYB
// success screen. Split from KeyPeopleInviteLinks so the same list serves both
// the moment of submission (rows built from what the applicant just typed) and
// a later revisit (rows rebuilt server-side, with live statuses).

export type AwaitRole = KeyPersonRole | 'authorized_representative' | (string & {});

export interface AwaitRow {
  name: string;
  role: AwaitRole;
  /** Ownership percentage, already formatted. */
  pct: string | null;
  /** ISO-2. Anything else has no flag to draw. */
  country: string | null;
  status: 'verified' | 'failed' | 'submitted' | 'pending' | 'not_needed';
  inviteUrl?: string;
  isApplicant?: boolean;
  /** A company on the list completes a KYB application, not a KYC. It gets a
   *  Company tag and its pending state reads "KYB pending". */
  isCorporate?: boolean;
}

/** Section order + headers, mirroring the grouped "Awaiting users" design. */
const SECTIONS: Array<{ role: string; label: string }> = [
  { role: 'beneficial_owner', label: 'UBOs' },
  { role: 'director', label: 'Directors' },
  { role: 'signatory', label: 'Signatories' },
  { role: 'shareholder', label: 'Shareholders' },
  { role: 'authorized_representative', label: 'Representatives' },
];

const KNOWN_ROLES = new Set(SECTIONS.map((s) => s.role));

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

const STATUS: Record<AwaitRow['status'], { label: string; className: string }> = {
  verified: { label: 'Verified', className: 'bg-[var(--kyc-success)]/10 text-[var(--kyc-success)]' },
  submitted: { label: 'Submitted', className: 'bg-[var(--kyc-success)]/10 text-[var(--kyc-success)]' },
  pending: { label: 'KYC pending', className: 'bg-primary/10 text-primary' },
  // Their invite was voided because the application itself ended. Nothing is
  // pending; it was called off, and saying "pending" sent people chasing links
  // that no longer worked.
  not_needed: { label: 'Not needed', className: 'bg-muted text-muted-foreground' },
  failed: { label: 'Check failed', className: 'bg-destructive/10 text-destructive' },
};

export function KeyPeopleAwaitList({ rows }: { rows: AwaitRow[] }) {
  if (rows.length === 0) return null;

  // Anything whose role we have no section for still has to appear. Grouping by
  // a fixed list and rendering only the matches quietly dropped people, which on
  // a screen whose whole job is "who still owes a check" is the worst failure it
  // could have.
  const groups: Array<{ label: string; rows: AwaitRow[] }> = SECTIONS.map(({ role, label }) => ({
    label,
    rows: rows.filter((r) => r.role === role),
  })).filter((g) => g.rows.length > 0);
  const others = rows.filter((r) => !KNOWN_ROLES.has(r.role as string));
  if (others.length > 0) groups.push({ label: 'Other people', rows: others });

  const outstanding = rows.filter((r) => r.status === 'pending' || r.status === 'failed').length;

  // Entrance stagger: cards rise in reading order, ~45ms apart, capped so a
  // long roster does not turn into a slow reveal. Together with the skeleton
  // this state replaces (drawn at the same geometry), the hand-off reads as
  // the ghost list resolving into the real one rather than a screen swap.
  let entranceIndex = 0;

  return (
    <div className="w-full space-y-4 text-left animate-fade-in motion-reduce:animate-none">
      {/* Everyone listed is somebody a check is asked of — the server leaves out
          anyone the flow asks nothing of, so there is no longer a subset to
          count. A screening-only signatory has no link and nothing anybody can
          do for them, and naming them here made a task list read as a roster. */}
      <p className="text-center text-sm text-muted-foreground">
        {outstanding === 0
          ? 'Everyone on this application has completed their identity check.'
          : 'To complete the review, the people below must verify their identity with a KYC check. Anyone with an email on file has already been sent their link.'}
      </p>

      {groups.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            {group.label}
          </p>
          {group.rows.map((row, i) => (
            <AwaitCard key={`${group.label}-${i}`} row={row} entranceDelayMs={Math.min(entranceIndex++, 8) * 45} />
          ))}
        </div>
      ))}

      {outstanding > 0 && (
        <p className="text-center text-xs text-muted-foreground">Links are valid for 14 days.</p>
      )}
    </div>
  );
}

function AwaitCard({ row, entranceDelayMs = 0 }: { row: AwaitRow; entranceDelayMs?: number }) {
  const [copied, setCopied] = useState(false);
  const status = STATUS[row.status];
  // A company is not doing a KYC: it receives its own KYB application, so the
  // pending pill must not promise a check that will never run under that name.
  const statusLabel = row.isCorporate && row.status === 'pending' ? 'KYB pending' : status.label;

  const copy = async () => {
    if (!row.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(row.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(`Copy ${row.name}'s verification link:`, row.inviteUrl);
    }
  };

  const roleLabel =
    APPLICANT_ROLE_LABELS[row.role as keyof typeof APPLICANT_ROLE_LABELS] ?? 'Key person';
  const meta = [roleLabel, ...(row.pct ? [`${row.pct}%`] : [])].join(' · ');

  return (
    // `backwards` fill keeps a delayed card invisible until its turn — without
    // it, every card flashes visible and then restarts its animation.
    <div
      className="space-y-3 rounded-2xl bg-muted/40 p-4 animate-slide-up [animation-fill-mode:backwards] motion-reduce:animate-none"
      style={entranceDelayMs ? { animationDelay: `${entranceDelayMs}ms` } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">
            {row.name}
            {row.isApplicant && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>
            )}
            {row.isCorporate && (
              // Readability over subtlety: foreground text on a bordered chip.
              // The muted-on-muted version disappeared on dark org themes.
              <span className="ml-1.5 inline-flex translate-y-[-1px] items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 align-middle text-xs font-semibold normal-case text-foreground">
                <Building2 className="h-3.5 w-3.5" /> Company
              </span>
            )}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            <span>{meta}</span>
            {row.country && (
              <>
                <span>·</span>
                <CountryFlag code={row.country} className="h-4 w-4" />
                <span>{countryName(row.country)}</span>
              </>
            )}
          </p>
        </div>
        {/* The icon is not decoration: status is also carried by colour, and
            colour alone is not a signal everyone receives. */}
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
            status.className,
          )}
        >
          {row.status === 'verified' && <BadgeCheck className="h-3.5 w-3.5" />}
          {statusLabel}
        </span>
      </div>

      {/* A failed check still gets its link — that is the retry. */}
      {row.inviteUrl && (
        <button
          type="button"
          onClick={() => void copy()}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary/10 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" /> Link copied
            </>
          ) : (
            <>
              <Link2 className="h-4 w-4" /> Copy verification link
            </>
          )}
        </button>
      )}
    </div>
  );
}
