'use client';

import React from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { DateField } from './DateField';
import type { CompanyInfoField, CompanyInfoMode } from '../types/business';
import { PhoneNumberInput } from './PhoneNumberInput';
import { isValidWebsite } from '../lib/website';
import { defaultCountry } from '../lib/country-default';

export interface CompanyInfoValues {
  address: string;
  email: string;
  phone: string;
  website: string;
  dateOfIncorporation: string;
  taxId: string;
  vatNumber: string;
  companyType: string;
  natureOfBusiness: string;
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
  // Registry facts the applicant states. Asked as THEIR answer rather than
  // filled from the register, because where the two differ that is the finding.
  {
    key: 'dateOfIncorporation',
    label: 'Date of incorporation',
    placeholder: 'YYYY-MM-DD',
    type: 'date',
  },
  { key: 'taxId', label: 'Tax ID', placeholder: 'e.g. 01234567-0001' },
  { key: 'vatNumber', label: 'VAT number', placeholder: 'e.g. NG123456789' },
  { key: 'companyType', label: 'Company type', placeholder: 'e.g. Private Limited Company' },
  {
    key: 'natureOfBusiness',
    label: 'Nature of business',
    placeholder: 'What the company does',
  },
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
  country,
  geoCountry,
  onChange,
}: {
  values: CompanyInfoValues;
  modes: Record<CompanyInfoField, CompanyInfoMode>;
  emailValid: boolean;
  /** Seeds the phone dial code: the company's country of registration. */
  country?: string;
  /** The visitor's IP country, used only when nothing better is known. */
  geoCountry?: string | null;
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
          (f.key === 'website' && value !== '' && !isValidWebsite(value)) ||
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
            {/* A date gets the picker, not a text box. The native date input
                renders differently in every browser and is unusable on some
                mobile keyboards, which is why the questionnaire already had
                this component. */}
            {f.key === 'phone' ? (
              // The same control the phone-verification step uses: dial-code
              // picker, as-you-type national formatting, E.164 out. A business
              // number is a phone number, and asking for one in a bare text box
              // gets back a dozen different shapes of the same digits.
              <PhoneNumberInput
                // The register often returns the company's phone, and until now
                // this control had no way to show it: it went into state, the
                // box stayed blank, and pressing Continue submitted a number the
                // applicant never saw as though they had given it.
                value={value}
                defaultCountry={defaultCountry(country, geoCountry)}
                geoCountry={geoCountry}
                onChange={({ e164 }) => onChange({ phone: e164 })}
              />
            ) : f.type === 'date' ? (
              <DateField
                inputId={`company-${f.key}`}
                value={value || undefined}
                placeholder={f.placeholder}
                onChange={(next) => onChange({ [f.key]: next ?? '' })}
              />
            ) : (
            <Input
              id={`company-${f.key}`}
              type={f.type}
              inputMode={f.inputMode}
              placeholder={f.placeholder}
              value={value}
              onChange={(e) => onChange({ [f.key]: e.target.value })}
              className={invalid ? 'border-destructive' : ''}
            />
            )}
            {f.key === 'email' && value !== '' && !emailValid && (
              <p className="text-sm text-destructive">Enter a valid email address.</p>
            )}
            {f.key === 'website' && value !== '' && !isValidWebsite(value) && (
              <p className="text-sm text-destructive">
                Enter a valid website, for example company.com
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
