'use client';

import React from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useText } from '../i18n';

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
  const t = useText();
  return (
    <div className="space-y-2">
      <Label htmlFor="contactEmail">
        {t('business.contactEmail.label')}
        <span className="text-muted-foreground"> {t('business.optional')}</span>
      </Label>
      <Input
        id="contactEmail"
        type="email"
        placeholder={t('business.contactEmail.placeholder')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={value && !valid ? 'border-destructive' : ''}
      />
      {value !== '' && !valid ? (
        <p className="text-sm text-destructive">{t('business.error.invalidEmail')}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{t('business.contactEmail.hint')}</p>
      )}
    </div>
  );
}
