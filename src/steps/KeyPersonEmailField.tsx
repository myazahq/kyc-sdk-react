'use client';

import React from 'react';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

/**
 * The key-person email field. Required exactly when this person is sent a
 * verification link (the workflow's requireEmail roles); a company has no
 * inbox and is never asked.
 */
export function KeyPersonEmailField({
  value,
  corp,
  needsEmail,
  invalid,
  onChange,
}: {
  value: string;
  corp: boolean;
  needsEmail: boolean;
  invalid: boolean;
  onChange: (email: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="kp-sheet-email">
        Email{' '}
        {needsEmail ? (
          <span className="text-destructive">*</span>
        ) : (
          <span className="text-muted-foreground">
            {corp ? '(optional)' : '(optional, used to send their verification link)'}
          </span>
        )}
      </Label>
      <Input
        id="kp-sheet-email"
        type="email"
        placeholder="name@company.com"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={invalid ? 'border-destructive' : ''}
      />
      {invalid && <p className="text-sm text-destructive">Enter a valid email address.</p>}
      {needsEmail && value.trim() === '' && (
        <p className="text-xs text-muted-foreground">
          Required: this is how they receive their own verification link.
        </p>
      )}
    </div>
  );
}
