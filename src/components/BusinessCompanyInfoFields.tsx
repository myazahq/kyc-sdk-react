'use client';

import React from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import type { CompanyInfoField, CompanyInfoMode } from '../types/business';

export interface CompanyInfoValues {
  address: string;
  email: string;
  phone: string;
  website: string;
}

const FIELD_DEFS: Array<{
  key: CompanyInfoField;
  label: string;
  placeholder: string;
  type?: string;
  inputMode?: 'email' | 'tel' | 'url';
}> = [
  { key: 'address', label: 'Registered address', placeholder: 'e.g. 12 Marina Road, Lagos' },
  { key: 'email', label: 'Business email', placeholder: 'hello@company.com', type: 'email', inputMode: 'email' },
  { key: 'phone', label: 'Business phone', placeholder: '+234 800 000 0000', type: 'tel', inputMode: 'tel' },
  { key: 'website', label: 'Website', placeholder: 'company.com', inputMode: 'url' },
];

/**
 * Company profile fields on the business-details step. Each field's mode comes
 * from the workflow config (off = hidden, required = blocks Continue); the
 * address is cross-checked against the official registry record server-side.
 */
export function BusinessCompanyInfoFields({
  values,
  modes,
  emailValid,
  onChange,
}: {
  values: CompanyInfoValues;
  modes: Record<CompanyInfoField, CompanyInfoMode>;
  emailValid: boolean;
  onChange: (patch: Partial<CompanyInfoValues>) => void;
}) {
  const visible = FIELD_DEFS.filter((f) => modes[f.key] !== 'off');
  if (visible.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Company information</p>
        <p className="text-xs text-muted-foreground">
          We verify these details against the official registry record.
        </p>
      </div>

      {visible.map((f) => {
        const required = modes[f.key] === 'required';
        const value = values[f.key];
        const invalid =
          (f.key === 'email' && value !== '' && !emailValid) ||
          (required && value.trim() === '' && false); // emptiness blocks Continue, not inline error
        return (
          <div key={f.key} className="space-y-2">
            <Label htmlFor={`company-${f.key}`}>
              {f.label}
              {required ? (
                <span className="text-destructive"> *</span>
              ) : (
                <span className="text-muted-foreground"> (optional)</span>
              )}
            </Label>
            <Input
              id={`company-${f.key}`}
              type={f.type}
              inputMode={f.inputMode}
              placeholder={f.placeholder}
              value={value}
              onChange={(e) => onChange({ [f.key]: e.target.value })}
              className={invalid ? 'border-destructive' : ''}
            />
            {f.key === 'email' && value !== '' && !emailValid && (
              <p className="text-sm text-destructive">Enter a valid email address.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
