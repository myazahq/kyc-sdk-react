'use client';

import React, { useState } from 'react';
import { ChevronRight, Info } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { isValidContactEmail } from '../lib/business';
import { rowNeedsEmail } from '../lib/business-application';
import {
  primaryRole,
  rolesOf,
  stakeOf,
  type KeyPeopleSection,
} from '../lib/key-people-sections';
import { cn } from '../lib/utils';
import { BusinessCountrySelect } from '../components/BusinessCountrySelect';
import { KeyPersonKindToggle } from './KeyPersonKindToggle';
import { KeyPersonRoleChips } from './KeyPersonRoleChips';
import { KeyPersonEmailField } from './KeyPersonEmailField';
import { KeyPersonOwnershipField } from './KeyPersonOwnershipField';
import { KeyPersonOwners } from './KeyPersonOwners';
import { ALL_REGION_CODES } from '../lib/regions';
import type { KeyPersonEntry } from '../context/types';
import type { KeyPersonRole } from '../types/business';

/**
 * The key-person FIELDS, scoped by the SECTION that opened the sheet: the
 * section already said what this person is, so no coarse role dropdown — the
 * UBO form asks name/stake/country/email, the shareholder form adds the
 * individual-or-company toggle, and the representative form picks between the
 * real classifications with the human nuance ("CFO, Board Member") captured as
 * a free-text title. No card chrome, no header: this is the body of the
 * add/edit sheet (KeyPersonSheet), which owns the draft state and the
 * save/remove actions.
 */
const EMPTY_ROLES: ReadonlySet<KeyPersonRole> = new Set();

export function KeyPersonForm({
  entry,
  section,
  onChange,
  uboThreshold = 25,
  combinedPctError = null,
  emailRequiredFor = EMPTY_ROLES,
  defaultCountry,
  corporateKyb = false,
}: {
  entry: KeyPersonEntry;
  /** The section whose add-tile or card opened the sheet. */
  section: KeyPeopleSection;
  /** The workflow sends corporate shareholders their own KYB application —
   *  the callout below must tell that truth instead of the screening-only one. */
  corporateKyb?: boolean;
  onChange: (patch: Partial<KeyPersonEntry>) => void;
  /** Ownership % at/above which the server treats a person as a beneficial
   *  owner (the workflow's `keyPeople.ownershipThreshold`, default 25). */
  uboThreshold?: number;
  /** Roles the workflow demands an address from. */
  emailRequiredFor?: ReadonlySet<KeyPersonRole>;
  /** The business's own country, pinned to the top of the country picker. */
  defaultCountry?: string;
  /**
   * Set when this draft's % would push the COMBINED ownership across all
   * people past 100% — shown on the % field as a warning. It never blocks
   * saving (the fix may live on a different person); the list's summary and
   * the disabled Continue enforce the total.
   */
  combinedPctError?: string | null;
}) {
  const nameInvalid = entry.name !== '' && entry.name.trim().length < 2;
  const emailInvalid = entry.email.trim() !== '' && !isValidContactEmail(entry.email.trim());
  const corp = entry.isCorporate;
  const needsEmail = rowNeedsEmail(entry, emailRequiredFor);
  const roles = rolesOf(entry);
  const stake = stakeOf(entry);
  const [showOwners, setShowOwners] = useState((entry.owners?.length ?? 0) > 0);

  const setRoles = (next: KeyPersonRole[]) =>
    onChange({ roles: next, role: primaryRole(next) });

  return (
    <div className="space-y-3">
      {/* Only shareholders can be a company: a beneficial owner is a natural
          person in every regime that defines one, and a representative form
          is about the people who act. */}
      {section === 'shareholders' && (
        <KeyPersonKindToggle
          isCorporate={corp}
          onChange={(isCorporate) =>
            // Beneficial ownership is a claim about a person, so switching to
            // a company reads the role set down rather than leaving an
            // impossible one.
            onChange({
              isCorporate,
              ...(isCorporate
                ? {
                    roles: roles.map((r) => (r === 'beneficial_owner' ? 'shareholder' : r)),
                    role: primaryRole(
                      roles.map((r) => (r === 'beneficial_owner' ? 'shareholder' : r)),
                    ),
                  }
                : { registrationNumber: '' }),
            })
          }
        />
      )}

      <div className="space-y-2">
        <Label htmlFor="kp-sheet-name">{corp ? 'Company name' : 'Full name'}</Label>
        <Input
          id="kp-sheet-name"
          placeholder={corp ? 'e.g. Acme Holdings Ltd' : 'e.g. Bola Owner'}
          value={entry.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={nameInvalid ? 'border-destructive' : ''}
        />
        {nameInvalid && (
          <p className="text-sm text-destructive">
            Enter the {corp ? 'registered company name' : 'person’s full name'}.
          </p>
        )}
      </div>

      {section === 'representatives' && (
        <KeyPersonRoleChips roles={roles} onRoles={setRoles} />
      )}

      {!corp && (
        <div className="space-y-2">
          <Label htmlFor="kp-sheet-title">
            Position or title <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="kp-sheet-title"
            placeholder="e.g. CFO, Board Member"
            value={entry.title ?? ''}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </div>
      )}

      <KeyPersonOwnershipField
        entry={entry}
        onChange={onChange}
        uboThreshold={uboThreshold}
        combinedPctError={combinedPctError}
      />
      {section === 'ubos' && stake != null && stake > 0 && stake < uboThreshold && (
        <p className="text-xs text-muted-foreground">
          Below {uboThreshold}% they will be recorded as a shareholder.
        </p>
      )}

      {corp && (
        <div className="space-y-2">
          <Label htmlFor="kp-sheet-rc">
            Registration number <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="kp-sheet-rc"
            placeholder="e.g. RC123456"
            value={entry.registrationNumber}
            onChange={(e) => onChange({ registrationNumber: e.target.value })}
          />
        </div>
      )}

      {/* COLLAPSED by default so the company sheet stays five fields; open
          when owners already exist (a restored draft, a look-through find).
          The capability is one tap away, not one field more. */}
      {corp && !showOwners && (
        <button
          type="button"
          onClick={() => setShowOwners(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
          Add the people who own it
          <span className="font-normal">(optional)</span>
        </button>
      )}
      {corp && showOwners && (
        <KeyPersonOwners
          owners={entry.owners ?? []}
          companyName={entry.name}
          onChange={(owners) => onChange({ owners })}
        />
      )}

      <div className="space-y-2">
        <Label htmlFor="kp-sheet-country">
          Country{' '}
          <span className="text-muted-foreground">
            {corp ? '(of incorporation)' : '(where their ID was issued)'}
          </span>
        </Label>
        <BusinessCountrySelect
          id="kp-sheet-country"
          countries={ALL_REGION_CODES}
          value={entry.country}
          onChange={(country) => onChange({ country })}
          groupAll
          defaultCode={defaultCountry}
        />
      </div>

      {/* What actually happens to a company on this list, stated as a callout
          rather than buried in a field helper, because it answers the question
          every applicant has at this exact point ("is the company going to be
          asked for a selfie?"). The answer depends on the workflow: with
          nested KYB on, the company IS sent its own application; without it,
          it is screened and its owners reviewed separately. */}
      {corp && (
        <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 p-3 text-sm text-foreground/80">
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            {corporateKyb
              ? 'This company will need its own KYB verification: it receives a link to a business application of its own, where the people who own it are identified. We also screen it against sanctions lists.'
              : 'A company is never asked to verify an identity. We check it against sanctions lists, and the people who own it are reviewed separately, so list its owners above if you know them.'}
          </p>
        </div>
      )}

      <KeyPersonEmailField
        value={entry.email}
        corp={corp}
        needsEmail={needsEmail}
        invalid={emailInvalid}
        onChange={(email) => onChange({ email })}
      />
    </div>
  );
}
