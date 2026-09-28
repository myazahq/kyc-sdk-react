'use client';

import React from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { DateField } from './DateField';
import type { CompanyInfoField, CompanyInfoMode } from '../types/business';
import { PhoneNumberInput } from './PhoneNumberInput';
import { isValidWebsite } from '../lib/website';
import { defaultCountry } from '../lib/country-default';
import { useText } from '../i18n';

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

// Each field's label and placeholder are texts keyed
// `business.companyInfo.<key>.label` / `.placeholder`.
const FIELD_DEFS: Array<{
  key: CompanyInfoField;
  type?: string;
  inputMode?: 'email' | 'tel' | 'url';
}> = [
  { key: 'address' },
  { key: 'email', type: 'email', inputMode: 'email' },
  { key: 'phone', type: 'tel', inputMode: 'tel' },
  { key: 'website', inputMode: 'url' },
  // Registry facts the applicant states. Asked as THEIR answer rather than
  // filled from the register, because where the two differ that is the finding.
  { key: 'dateOfIncorporation', type: 'date' },
  { key: 'taxId' },
  { key: 'vatNumber' },
  { key: 'companyType' },
  { key: 'natureOfBusiness' },
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
  const t = useText();
  const visible = FIELD_DEFS.filter((f) => modes[f.key] !== 'off');
  if (visible.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{t('business.companyInfo.title')}</p>
        <p className="text-xs text-muted-foreground">{t('business.companyInfo.description')}</p>
      </div>

      {visible.map((f) => {
        const required = modes[f.key] === 'required';
        const value = values[f.key];
        const placeholder = t(`business.companyInfo.${f.key}.placeholder`);
        const invalid =
          (f.key === 'email' && value !== '' && !emailValid) ||
          (f.key === 'website' && value !== '' && !isValidWebsite(value)) ||
          (required && value.trim() === '' && false); // emptiness blocks Continue, not inline error
        return (
          <div key={f.key} className="space-y-2">
            <Label htmlFor={`company-${f.key}`}>
              {t(`business.companyInfo.${f.key}.label`)}
              {required ? (
                <span className="text-destructive"> *</span>
              ) : (
                <span className="text-muted-foreground"> {t('business.optional')}</span>
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
                placeholder={placeholder}
                onChange={(next) => onChange({ [f.key]: next ?? '' })}
              />
            ) : (
            <Input
              id={`company-${f.key}`}
              type={f.type}
              inputMode={f.inputMode}
              placeholder={placeholder}
              value={value}
              onChange={(e) => onChange({ [f.key]: e.target.value })}
              className={invalid ? 'border-destructive' : ''}
            />
            )}
            {f.key === 'email' && value !== '' && !emailValid && (
              <p className="text-sm text-destructive">{t('business.error.invalidEmail')}</p>
            )}
            {f.key === 'website' && value !== '' && !isValidWebsite(value) && (
              <p className="text-sm text-destructive">{t('business.error.invalidWebsite')}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
