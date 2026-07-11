'use client';

import React from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface BusinessContactEmailFieldProps {
  value: string;
  /** Format validity (empty counts as valid — the field is optional). */
  valid: boolean;
  onChange: (value: string) => void;
}

/**
 * Optional contact-email input for key-people (owner) verification invites —
 * rendered on the business-details step when the workflow's `keyPeople` config
 * emails full-KYC invite links (see `keyPeopleNeedsContactEmail`). Extracted so
 * the step file stays within the 200-line rule.
 */
export function BusinessContactEmailField({ value, valid, onChange }: BusinessContactEmailFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="contactEmail">
        Contact email for owner verification
        <span className="text-muted-foreground"> (optional)</span>
      </Label>
      <Input
        id="contactEmail"
        type="email"
        placeholder="admin@company.com"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={value && !valid ? 'border-destructive' : ''}
      />
      {value !== '' && !valid ? (
        <p className="text-sm text-destructive">Enter a valid email address.</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          We&apos;ll email this address a link for your directors and owners to verify their
          identity.
        </p>
      )}
    </div>
  );
}
