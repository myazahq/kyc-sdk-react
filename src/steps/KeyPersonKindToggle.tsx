'use client';

import React from 'react';
import { Building2, User } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * Person or company.
 *
 * The first question on the form, because it changes what the rest of it asks:
 * a company has a registration number rather than a date of birth, and no
 * identity of its own to verify. Left unasked, a limited company was collected
 * as a person, escalated to beneficial owner (which by definition means a
 * natural person), and sent a link to take a selfie.
 */
export function KeyPersonKindToggle({
  isCorporate,
  onChange,
}: {
  isCorporate: boolean;
  onChange: (isCorporate: boolean) => void;
}) {
  const options: Array<{ value: boolean; label: string; Icon: typeof User }> = [
    { value: false, label: 'A person', Icon: User },
    { value: true, label: 'A company', Icon: Building2 },
  ];
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium leading-none">Who is this?</span>
      <div role="radiogroup" aria-label="Who is this?" className="grid grid-cols-2 gap-2">
        {options.map(({ value, label, Icon }) => {
          const selected = isCorporate === value;
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(value)}
              className={cn(
                'flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors',
                selected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted/50',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
