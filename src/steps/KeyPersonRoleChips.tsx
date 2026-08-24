'use client';

import React from 'react';
import { Label } from '../components/ui/label';
import { cn } from '../lib/utils';
import type { KeyPersonRole } from '../types/business';

/** The representative hats on offer — real classifications, not job titles
 *  (those go in the free-text position field). */
const REP_ROLES: Array<{ role: KeyPersonRole; label: string }> = [
  { role: 'director', label: 'Director' },
  { role: 'signatory', label: 'Signatory' },
];

/**
 * The representative form's role chips. Multi-select over the entry's role
 * SET (a chairman who also signs holds both), with the last representative
 * hat pinned on: unticking it would silently drop the person from the section
 * they are being edited in.
 */
export function KeyPersonRoleChips({
  roles,
  onRoles,
}: {
  roles: KeyPersonRole[];
  onRoles: (next: KeyPersonRole[]) => void;
}) {
  const repCount = roles.filter((r) => r === 'director' || r === 'signatory').length;
  return (
    <div className="space-y-2">
      <Label>Role</Label>
      <div className="flex flex-wrap gap-2">
        {REP_ROLES.map(({ role, label }) => {
          const active = roles.includes(role);
          return (
            <button
              key={role}
              type="button"
              aria-pressed={active}
              onClick={() => {
                if (active && repCount <= 1) return;
                onRoles(active ? roles.filter((r) => r !== role) : [...roles, role]);
              }}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/40',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
