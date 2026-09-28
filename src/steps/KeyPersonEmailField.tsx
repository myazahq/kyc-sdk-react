'use client';

import React from 'react';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useText } from '../i18n';

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
  const t = useText();
  return (
    <div className="space-y-2">
      <Label htmlFor="kp-sheet-email">
        {t('keyPeople.form.email.label')}{' '}
        {needsEmail ? (
          <span className="text-destructive">*</span>
        ) : (
          <span className="text-muted-foreground">
            {t(corp ? 'keyPeople.form.optional' : 'keyPeople.form.email.optionalPerson')}
          </span>
        )}
      </Label>
      <Input
        id="kp-sheet-email"
        type="email"
        placeholder={t('keyPeople.form.email.placeholder')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={invalid ? 'border-destructive' : ''}
      />
      {invalid && <p className="text-sm text-destructive">{t('keyPeople.form.email.invalid')}</p>}
      {needsEmail && value.trim() === '' && (
        <p className="text-xs text-muted-foreground">{t('keyPeople.form.email.requiredHint')}</p>
      )}
    </div>
  );
}
