'use client';

import React from 'react';
import { Check, FileText, House, Landmark, Stamp, Zap, type AppIconComponent } from '../components/icons';
import { cn } from '../lib/utils';
import type { PoaDocumentType } from '../types/config';

/**
 * One icon per document kind, under the SAME names the RN `Icon` map and
 * Flutter's `LucideIcons` carry, so the three SDKs pick the same icon for the
 * same kind. Web draws them from Hugeicons (the dashboard's set); the mobile
 * SDKs still draw Lucide's, so a kind reads consistently within each platform
 * and the list stays in lockstep by MEANING rather than by glyph.
 */
export const POA_TYPE_ICONS: Record<PoaDocumentType, AppIconComponent> = {
  utility_bill: Zap,
  bank_statement: Landmark,
  tenancy_agreement: House,
  government_document: Stamp,
  other: FileText,
};

/**
 * The document kinds LISTED OUT as the questionnaire's multi-select cards
 * (`rounded-xl border p-3`, a square check, primary when picked, an icon
 * beside the label) rather than hidden behind a select — the options are the
 * information, and a dropdown makes the person open it to find out what is on
 * offer (user decision 2026-09-05). ONE kind is picked, because one document
 * is uploaded: the cards are radios wearing the multi-select's square check.
 * Locked (disabled) once a file is attached, so the kind cannot drift from
 * the document already uploaded.
 */
export function PoaDocumentTypeList({
  labelledBy,
  options,
  value,
  disabled,
  onChange,
}: {
  /** The id of the visible "Document type" label. */
  labelledBy: string;
  options: Array<{ value: PoaDocumentType; label: string }>;
  value: PoaDocumentType;
  disabled?: boolean;
  onChange: (value: PoaDocumentType) => void;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-col gap-2">
      {options.map((opt) => {
        const Icon = POA_TYPE_ICONS[opt.value];
        const checked = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-xl border p-3 text-left text-sm transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              checked ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
              )}
            >
              {checked && <Check className="h-3.5 w-3.5" />}
            </span>
            <Icon
              aria-hidden
              className={cn('h-5 w-5 shrink-0', checked ? 'text-primary' : 'text-muted-foreground')}
            />
            <span className="flex-1">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
