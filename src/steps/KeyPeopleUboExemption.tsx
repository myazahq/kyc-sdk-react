'use client';

import React from 'react';
import { Checkbox } from '../components/ui/checkbox';

/**
 * The FATF fallback, attested: some companies genuinely have no natural
 * person who qualifies as a UBO (listed companies, complex trusts, nominee
 * arrangements), and without this box the applicant's only moves were to
 * stall or to invent one. It is an attestation the org can branch on, never a
 * verdict — the registry lookup still says what it says — and it is disabled
 * the moment a UBO is listed, because the two claims contradict.
 */
export function KeyPeopleUboExemption({
  checked,
  hasUbos,
  onChange,
}: {
  checked: boolean;
  /** Someone IS listed as a UBO, so the exemption cannot also be claimed. */
  hasUbos: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label
        className={
          hasUbos
            ? 'flex cursor-not-allowed items-start gap-3 opacity-50'
            : 'flex cursor-pointer items-start gap-3'
        }
      >
        <Checkbox
          checked={checked}
          disabled={hasUbos}
          onCheckedChange={(value) => onChange(value === true)}
          className="mt-0.5"
        />
        <span className="text-sm text-muted-foreground">
          UBOs cannot be identified due to public share structures, complex trusts or nominee
          arrangements.
        </span>
      </label>
      {checked && !hasUbos && (
        <p className="pl-7 text-xs text-muted-foreground">
          We will record this with the application; a senior person is still identified through
          the applicant&apos;s own verification.
        </p>
      )}
    </div>
  );
}
