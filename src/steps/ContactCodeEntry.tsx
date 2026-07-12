'use client';

import React from 'react';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../components/ui/input-otp';
import type { OtpInputStyle } from '../types/config';

// The OTP code entry. Which field renders — a segmented shadcn OTP field or a
// plain text field — is chosen by the ORG in the workflow builder (config
// `inputStyle`), not by the end user. `codeLength` drives the segmented slots.

interface ContactCodeEntryProps {
  code: string;
  onChange: (code: string) => void;
  codeLength: number;
  /** Config-driven field style ('segmented' default). */
  style: OtpInputStyle;
  disabled?: boolean;
  /** Fires with the full code when the last slot is filled (auto-submit). */
  onComplete?: (code: string) => void;
}

export function ContactCodeEntry({ code, onChange, codeLength, style, disabled, onComplete }: ContactCodeEntryProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="contact-code">Verification code</Label>

      {style === 'text' ? (
        <Input
          id="contact-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder={'0'.repeat(codeLength)}
          maxLength={codeLength}
          className="text-center text-lg font-semibold tracking-[0.4em]"
          value={code}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, '').slice(0, codeLength);
            onChange(next);
            if (next.length === codeLength) onComplete?.(next);
          }}
          disabled={disabled}
        />
      ) : (
        <div className="flex justify-center py-1">
          <InputOTP
            id="contact-code"
            maxLength={codeLength}
            value={code}
            onChange={onChange}
            onComplete={onComplete}
            disabled={disabled}
            containerClassName="justify-center"
          >
            <InputOTPGroup>
              {Array.from({ length: codeLength }, (_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
      )}
    </div>
  );
}
