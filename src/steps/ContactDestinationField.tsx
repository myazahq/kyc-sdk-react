'use client';

import React from 'react';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PhoneNumberInput } from '../components/PhoneNumberInput';

/**
 * The "where should we send it" field on the contact-verification step: a plain
 * email input, or the dial-code phone input that emits E.164 plus validity.
 *
 * Split out of ContactVerificationStep so the step itself stays inside the
 * 200-line rule once the delivery-channel picker joined it.
 */
export function ContactDestinationField({
  isEmail,
  email,
  onEmailChange,
  onPhoneChange,
  defaultCountry,
  geoCountry,
  disabled,
}: {
  isEmail: boolean;
  email: string;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: { e164: string; isValid: boolean }) => void;
  defaultCountry?: string;
  /** The visitor's IP country, pinned and tagged at the top of the picker. */
  geoCountry?: string | null;
  disabled?: boolean;
}) {
  if (isEmail) {
    return (
      <div className="space-y-2">
        <Label htmlFor="contact-destination">Email address</Label>
        <Input
          id="contact-destination"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Phone number</Label>
      <PhoneNumberInput
        defaultCountry={defaultCountry}
        geoCountry={geoCountry}
        disabled={disabled}
        onChange={onPhoneChange}
      />
    </div>
  );
}
