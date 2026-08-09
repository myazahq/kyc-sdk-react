'use client';

import React from 'react';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { cn } from '../lib/utils';
import { isValidContactEmail } from '../lib/business';
import { KEY_PERSON_ROLE_LABELS } from '../lib/business-application';
import { BusinessCountrySelect } from '../components/BusinessCountrySelect';
import { ALL_REGION_CODES } from '../lib/regions';
import type { KeyPersonEntry } from '../context/types';
import type { KeyPersonRole } from '../types/business';

const ROLES = Object.keys(KEY_PERSON_ROLE_LABELS) as KeyPersonRole[];

/** Whether the role is an ownership one (% field is only meaningful then). */
function isOwnerRole(role: KeyPersonRole): boolean {
  return role === 'beneficial_owner' || role === 'shareholder';
}

/**
 * The key-person FIELDS — full name → role → ownership % → country → email —
 * with the same live per-field validation the old inline row had. No card
 * chrome, no header: this is the body of the add/edit sheet (KeyPersonSheet),
 * which owns the draft state and the save/remove actions.
 */
export function KeyPersonForm({
  entry,
  onChange,
  uboThreshold = 25,
  combinedPctError = null,
}: {
  entry: KeyPersonEntry;
  onChange: (patch: Partial<KeyPersonEntry>) => void;
  /** Ownership % at/above which the server treats a person as a beneficial
   *  owner (the workflow's `keyPeople.ownershipThreshold`, default 25). */
  uboThreshold?: number;
  /**
   * Set when this draft's % would push the COMBINED ownership across all
   * people past 100% — shown on the % field as a warning. It never blocks
   * saving (the fix may live on a different person); the list's summary and
   * the disabled Continue enforce the total.
   */
  combinedPctError?: string | null;
}) {
  const nameInvalid = entry.name !== '' && entry.name.trim().length < 2;
  const emailInvalid = entry.email.trim() !== '' && !isValidContactEmail(entry.email.trim());
  const pct = entry.ownershipPct.trim();
  const pctNum = Number(pct);
  const pctInvalid = pct !== '' && (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100);
  // Surface the regulatory consequence as feedback: at/above the threshold the
  // server escalates this person to a beneficial owner regardless of the role
  // picked. Quiet when they already chose UBO — nothing new to say.
  const uboHint =
    !pctInvalid && pct !== '' && pctNum >= uboThreshold && entry.role !== 'beneficial_owner';

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="kp-sheet-name">Full name</Label>
        <Input
          id="kp-sheet-name"
          placeholder="e.g. Bola Owner"
          value={entry.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={nameInvalid ? 'border-destructive' : ''}
        />
        {nameInvalid && <p className="text-sm text-destructive">Enter the person’s full name.</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="kp-sheet-role">Role</Label>
          <Select value={entry.role} onValueChange={(role) => onChange({ role: role as KeyPersonRole })}>
            <SelectTrigger id="kp-sheet-role">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {KEY_PERSON_ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="kp-sheet-pct">
            Ownership % <span className="text-muted-foreground">(optional)</span>
          </Label>
          <div className="relative">
            {/* Native spinners hidden: the % suffix takes their corner, and a
                known-exact value is typed, not stepped. */}
            <Input
              id="kp-sheet-pct"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              placeholder={isOwnerRole(entry.role) ? 'e.g. 60' : '—'}
              value={entry.ownershipPct}
              onChange={(e) => onChange({ ownershipPct: e.target.value })}
              className={cn(
                'pr-8 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                (pctInvalid || combinedPctError) && 'border-destructive',
              )}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
            >
              %
            </span>
          </div>
          {pctInvalid && <p className="text-sm text-destructive">Enter a value between 0 and 100.</p>}
          {!pctInvalid && combinedPctError && (
            <p className="text-sm text-destructive">{combinedPctError}</p>
          )}
          {uboHint && (
            <p className="text-xs text-muted-foreground">
              At {uboThreshold}% or more, this person counts as a beneficial owner.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="kp-sheet-country">
          Country <span className="text-muted-foreground">(where their ID was issued)</span>
        </Label>
        <BusinessCountrySelect
          id="kp-sheet-country"
          countries={ALL_REGION_CODES}
          value={entry.country}
          onChange={(country) => onChange({ country })}
          groupAll
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="kp-sheet-email">
          Email <span className="text-muted-foreground">(optional — used to send their verification link)</span>
        </Label>
        <Input
          id="kp-sheet-email"
          type="email"
          placeholder="name@company.com"
          value={entry.email}
          onChange={(e) => onChange({ email: e.target.value })}
          className={emailInvalid ? 'border-destructive' : ''}
        />
        {emailInvalid && <p className="text-sm text-destructive">Enter a valid email address.</p>}
      </div>
    </div>
  );
}
