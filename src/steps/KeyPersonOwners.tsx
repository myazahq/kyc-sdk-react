'use client';

import React from 'react';
import { Plus, X } from '../components/icons';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import type { KeyPersonOwnerEntry } from '../context/types';
import { useText } from '../i18n';

const MAX_OWNERS = 10;

const EMPTY: KeyPersonOwnerEntry = { name: '', ownershipPct: '', email: '', country: '' };

/**
 * Who owns this company.
 *
 * A beneficial owner is a natural person, so a corporate shareholder is a
 * branch of the ownership chain that stops at a legal entity. Where the company
 * is registered somewhere we can look up, the server follows it. Where it is
 * not — a foreign parent, an offshore vehicle — this is the only route to the
 * people above it, and asking is better than recording nothing.
 *
 * Deliberately short: a name and a share. Everything else about them is
 * unknowable to the person filling in this form, and a longer list is one
 * people abandon.
 */
export function KeyPersonOwners({
  owners,
  onChange,
  companyName,
}: {
  owners: KeyPersonOwnerEntry[];
  onChange: (owners: KeyPersonOwnerEntry[]) => void;
  companyName: string;
}) {
  const t = useText();
  const company = companyName.trim();
  const patch = (index: number, next: Partial<KeyPersonOwnerEntry>) =>
    onChange(owners.map((o, i) => (i === index ? { ...o, ...next } : o)));

  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <div className="space-y-1">
        <Label>
          {company
            ? t('keyPeople.form.owners.title', { company })
            : t('keyPeople.form.owners.titleUnnamed')}{' '}
          <span className="text-muted-foreground">{t('keyPeople.form.optional')}</span>
        </Label>
        <p className="text-xs text-muted-foreground">{t('keyPeople.form.owners.description')}</p>
      </div>

      {owners.map((owner, index) => (
        <div key={index} className="flex items-start gap-2">
          <Input
            placeholder={t('keyPeople.form.owners.namePlaceholder')}
            aria-label={`Owner ${index + 1} name`}
            value={owner.name}
            onChange={(e) => patch(index, { name: e.target.value })}
            className="flex-1"
          />
          <div className="relative w-24 shrink-0">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              placeholder="%"
              aria-label={`Owner ${index + 1} share`}
              value={owner.ownershipPct}
              onChange={(e) => patch(index, { ownershipPct: e.target.value })}
              className="pr-7 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
            >
              %
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove owner ${index + 1}`}
            onClick={() => onChange(owners.filter((_, i) => i !== index))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {owners.length < MAX_OWNERS && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onChange([...owners, { ...EMPTY }])}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t(owners.length === 0 ? 'keyPeople.form.owners.add' : 'keyPeople.form.owners.addAnother')}
        </Button>
      )}
    </div>
  );
}
