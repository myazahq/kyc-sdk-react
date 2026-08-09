'use client';

import React, { useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { CountryFlag } from '../components/CountryFlag';
import { useKYCContext } from '../context/KYCContext';
import { APPLICANT_ROLE_LABELS } from '../lib/business-application';
import { cn } from '../lib/utils';
import type { KeyPersonRole } from '../types/business';

export interface KeyPersonInvite {
  keyPersonId: string;
  name: string;
  inviteUrl: string;
}

type AwaitRole = KeyPersonRole | 'authorized_representative';

interface AwaitRow {
  name: string;
  role: AwaitRole;
  pct: string | null;
  country: string | null;
  /** 'submitted' = the applicant's own in-flow KYC; 'pending' = has a link. */
  status: 'submitted' | 'pending';
  inviteUrl?: string;
  isApplicant?: boolean;
}

/** Section order + headers, mirroring the grouped "Awaiting users" design. */
const SECTIONS: Array<{ role: AwaitRole; label: string }> = [
  { role: 'beneficial_owner', label: 'UBOs' },
  { role: 'director', label: 'Directors' },
  { role: 'signatory', label: 'Signatories' },
  { role: 'shareholder', label: 'Shareholders' },
  { role: 'authorized_representative', label: 'Representatives' },
];

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * "Awaiting users" — the KYB success screen's people section. Every person
 * whose verification the review is waiting on, grouped by role, each with a
 * status pill; pending people carry a copyable verification link, and the
 * APPLICANT (who verified in-flow) appears with a green Submitted pill so the
 * picture is complete. Links stay valid for 14 days; people with an email on
 * file also receive theirs automatically.
 */
export function KeyPeopleInviteLinks({ invites }: { invites: KeyPersonInvite[] }) {
  const { state } = useKYCContext();
  const app = state.businessApplication;
  if (invites.length === 0) return null;

  const rows: AwaitRow[] = [];

  // The applicant themselves — verified in-flow, nothing more to do.
  if (app.applicantRole) {
    const self =
      app.applicantKeyPersonIndex !== null ? app.keyPeople[app.applicantKeyPersonIndex] : null;
    rows.push({
      name: (self?.name ?? app.applicantName).trim() || 'You',
      role: (self?.role ?? app.applicantRole) as AwaitRole,
      pct: self?.ownershipPct.trim() || null,
      country: self?.country.trim() ? self.country.trim().toUpperCase() : null,
      status: 'submitted',
      isApplicant: true,
    });
  }

  // Everyone the server minted a link for — enrich from the entered rows.
  for (const invite of invites) {
    const entered = app.keyPeople.find((p) => p.name.trim() === invite.name.trim());
    rows.push({
      name: invite.name,
      role: (entered?.role ?? 'director') as AwaitRole,
      pct: entered?.ownershipPct.trim() || null,
      country: entered?.country.trim() ? entered.country.trim().toUpperCase() : null,
      status: 'pending',
      inviteUrl: invite.inviteUrl,
    });
  }

  return (
    <div className="w-full space-y-4 text-left">
      <p className="text-center text-sm text-muted-foreground">
        To complete the review, the people below must verify their identity with a KYC check.
        Anyone with an email on file has already been sent their link.
      </p>

      {SECTIONS.map(({ role, label }) => {
        const group = rows.filter((r) => r.role === role);
        if (group.length === 0) return null;
        return (
          <div key={role} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {label}
            </p>
            {group.map((row, i) => (
              <AwaitCard key={`${role}-${i}`} row={row} />
            ))}
          </div>
        );
      })}

      <p className="text-center text-xs text-muted-foreground">
        Links are valid for 14 days.
      </p>
    </div>
  );
}

function AwaitCard({ row }: { row: AwaitRow }) {
  const [copied, setCopied] = useState(false);

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

  const meta = [
    APPLICANT_ROLE_LABELS[row.role],
    ...(row.pct ? [`${row.pct}%`] : []),
  ].join(' · ');

  return (
    <div className="space-y-3 rounded-2xl bg-muted/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">
            {row.name}
            {row.isApplicant && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}
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
        <span
          className={cn(
            'shrink-0 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
            row.status === 'submitted'
              ? 'bg-[#0DA211]/10 text-[#0DA211]'
              : 'bg-primary/10 text-primary',
          )}
        >
          {row.status === 'submitted' ? 'Submitted' : 'KYC pending'}
        </span>
      </div>

      {row.status === 'pending' && row.inviteUrl && (
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
