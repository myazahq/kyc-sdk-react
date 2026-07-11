'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { isValidContactEmail } from '../lib/business';
import { KEY_PERSON_ROLE_LABELS } from '../lib/business-application';
import { BusinessCountrySelect } from '../components/BusinessCountrySelect';
import { ALL_REGION_CODES } from '../lib/regions';
import type { KeyPersonEntry } from '../context/types';
import type { KeyPersonRole } from '../types/business';

interface BusinessKeyPersonRowProps {
  index: number;
  entry: KeyPersonEntry;
  onChange: (patch: Partial<KeyPersonEntry>) => void;
  onRemove: () => void;
}

const ROLES = Object.keys(KEY_PERSON_ROLE_LABELS) as KeyPersonRole[];

/** Whether the row's role is an ownership one (% field is only meaningful then). */
function isOwnerRole(role: KeyPersonRole): boolean {
  return role === 'beneficial_owner' || role === 'shareholder';
}

/** One editable director/owner row on the business-key-people step. */
export function BusinessKeyPersonRow({ index, entry, onChange, onRemove }: BusinessKeyPersonRowProps) {
  const nameInvalid = entry.name !== '' && entry.name.trim().length < 2;
  const emailInvalid = entry.email.trim() !== '' && !isValidContactEmail(entry.email.trim());
  const pct = entry.ownershipPct.trim();
  const pctNum = Number(pct);
  const pctInvalid = pct !== '' && (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100);

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Person {index + 1}
        </p>
        <button
          type="button"
          aria-label={`Remove person ${index + 1}`}
          onClick={onRemove}
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`kp-name-${index}`}>Full name</Label>
        <Input
          id={`kp-name-${index}`}
          placeholder="e.g. Bola Owner"
          value={entry.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={nameInvalid ? 'border-destructive' : ''}
        />
        {nameInvalid && <p className="text-sm text-destructive">Enter the person’s full name.</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`kp-role-${index}`}>Role</Label>
          <Select value={entry.role} onValueChange={(role) => onChange({ role: role as KeyPersonRole })}>
            <SelectTrigger id={`kp-role-${index}`}>
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
          <Label htmlFor={`kp-pct-${index}`}>
            Ownership % <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id={`kp-pct-${index}`}
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            placeholder={isOwnerRole(entry.role) ? 'e.g. 60' : '—'}
            value={entry.ownershipPct}
            onChange={(e) => onChange({ ownershipPct: e.target.value })}
            className={pctInvalid ? 'border-destructive' : ''}
          />
          {pctInvalid && <p className="text-sm text-destructive">Enter a value between 0 and 100.</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`kp-country-${index}`}>
          Country <span className="text-muted-foreground">(where their ID was issued)</span>
        </Label>
        <BusinessCountrySelect
          id={`kp-country-${index}`}
          countries={ALL_REGION_CODES}
          value={entry.country}
          onChange={(country) => onChange({ country })}
          groupAll
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`kp-email-${index}`}>
          Email <span className="text-muted-foreground">(optional — used to send their verification link)</span>
        </Label>
        <Input
          id={`kp-email-${index}`}
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
