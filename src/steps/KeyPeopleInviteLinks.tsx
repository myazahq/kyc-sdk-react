'use client';

import React, { useState } from 'react';
import { Check, Copy, Link2 } from 'lucide-react';

export interface KeyPersonInvite {
  keyPersonId: string;
  name: string;
  inviteUrl: string;
}

/**
 * Copyable verification links for the key people the applicant listed —
 * rendered on the KYB success screen so the applicant can send each person
 * their link immediately (links stay valid for 14 days; people with an email
 * on file also receive theirs automatically).
 */
export function KeyPeopleInviteLinks({ invites }: { invites: KeyPersonInvite[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  if (invites.length === 0) return null;

  const copy = async (invite: KeyPersonInvite) => {
    try {
      await navigator.clipboard.writeText(invite.inviteUrl);
      setCopiedId(invite.keyPersonId);
      setTimeout(() => setCopiedId((prev) => (prev === invite.keyPersonId ? null : prev)), 2000);
    } catch {
      // Clipboard unavailable (permissions/iframe) — select-and-copy fallback.
      window.prompt(`Copy ${invite.name}'s verification link:`, invite.inviteUrl);
    }
  };

  return (
    <div className="w-full space-y-3 text-left">
      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Link2 className="h-4 w-4 shrink-0 text-primary" />
          Verification links for your key people
        </p>
        <p className="text-xs text-muted-foreground">
          Send each person their link — their identity must be verified to complete the review.
          Links are valid for 14 days.
        </p>
      </div>
      <div className="space-y-2">
        {invites.map((invite) => (
          <div
            key={invite.keyPersonId}
            className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{invite.name}</p>
              <p className="truncate text-xs text-muted-foreground">{invite.inviteUrl}</p>
            </div>
            <button
              type="button"
              onClick={() => void copy(invite)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              {copiedId === invite.keyPersonId ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[var(--kyc-success,#0DA211)]" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy link
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
