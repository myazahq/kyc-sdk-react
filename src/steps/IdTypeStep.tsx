'use client';

import React from 'react';
import {
  Fingerprint,
  FileText,
  Landmark,
  IdCard,
  Contact,
  BookUser,
  Car,
} from 'lucide-react';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/ui/button';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { cn } from '../lib/utils';
import { useKYCContext } from '../context/KYCContext';
import { useKYCConfig } from '../context/KYCConfigContext';
import { listIdTypeDefinitions } from '../utils/id-definitions';
import type { AnyIdType, AnyCountry, IdTypeDefinition } from '../types/config';

// Keyed by idType key, so the generic Global-Documents types (passport /
// drivers-license / national-id) get sensible icons in ANY country; unknown
// keys fall back to the generic document icon (FileText) below.
const ID_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  bvn: Landmark, // Bank Verification Number → bank/landmark
  nin: Fingerprint,
  vnin: Fingerprint,
  passport: BookUser,
  'drivers-license': Car,
  pvc: Contact, // Permanent Voter's Card
  'ghana-card': IdCard,
  voters: Contact,
  ssnit: IdCard,
  'national-id': IdCard,
  cni: IdCard,
  'residence-card': IdCard,
};

interface IdTypeStepProps {
  country?: AnyCountry;
  allowedIdTypes?: AnyIdType[];
}

export function IdTypeStep({ country, allowedIdTypes }: IdTypeStepProps = {}) {
  const { state, dispatch } = useKYCContext();
  const config = useKYCConfig();
  const { serverConfig } = config;

  // Determine which country to use — prop override or default to NG
  const resolvedCountry: AnyCountry = country ?? 'NG';

  // Local curated definitions ∪ server-synthesized ones (Global Documents) —
  // countries with no local ID_TYPES entry render entirely from server rows.
  const allTypes: readonly IdTypeDefinition[] = listIdTypeDefinitions(
    resolvedCountry,
    serverConfig.idTypes,
  );
  // An empty allowlist means "offer everything granted", same as absent — the
  // server treats [] that way, so the picker must too.
  const propAllowed =
    allowedIdTypes && allowedIdTypes.length > 0
      ? allTypes.filter((t) => allowedIdTypes.includes(t.key))
      : allTypes;

  // Intersect with the server-driven access list. While the config is still
  // loading we show nothing (a loader renders below); on error we fall back
  // to the prop list so the SDK is at worst as restrictive as the server.
  const grantedKeys = new Set(
    serverConfig.idTypes
      .filter((row) => row.country === resolvedCountry)
      .map((row) => row.idType),
  );
  const grantedVisible =
    serverConfig.status === 'ready'
      ? propAllowed.filter((t) => grantedKeys.has(t.key))
      : serverConfig.status === 'error'
        ? propAllowed
        : [];
  // Document Intelligence off ⇒ number-only IDs only (there's no document
  // capture step), so drop every document-scanned ID from the picker. This is
  // what makes the disabled "Document Intelligence" step actually disappear from
  // the live flow rather than still offering passports/licenses.
  const visibleTypes =
    config.enableDocumentCapture === false
      ? grantedVisible.filter((t) => !t.requiresDocumentCapture)
      : grantedVisible;

  const handleSelect = (value: string) => {
    dispatch({ type: 'SELECT_ID_TYPE', payload: value });
  };

  const handleContinue = () => {
    if (!state.selectedIdType) return;
    // Number-only IDs (e.g. BVN/NIN/vNIN) skip straight to id-input; every
    // document-scanned ID goes through document-capture.
    const def = config.getIdTypeDefinition(state.selectedIdType, resolvedCountry);
    const next = def && !def.requiresDocumentCapture ? 'id-input' : 'document-capture';
    dispatch({ type: 'SET_STEP', payload: next });
  };

  const handleBack = () => {
    dispatch({
      type: 'SET_STEP',
      payload: (config.countries?.length ?? 0) > 1 ? 'country-select' : 'consent',
    });
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <StepHeader
        title="Select ID Type"
        description="Choose the type of identification document you'd like to use."
        onBack={handleBack}
        country={resolvedCountry}
      />

      {serverConfig.status === 'loading' ? (
        <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground">
          Loading available ID types…
        </div>
      ) : serverConfig.status === 'ready' && visibleTypes.length === 0 ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          No ID types are enabled for your organization. Contact your administrator to request access.
        </div>
      ) : null}

      <RadioGroup
        value={state.selectedIdType ?? ''}
        onValueChange={handleSelect}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        {visibleTypes.map((idType) => {
          const Icon = ID_TYPE_ICONS[idType.key] ?? FileText;
          const isSelected = state.selectedIdType === idType.key;

          return (
            <Label key={idType.key} htmlFor={idType.key} className="cursor-pointer">
              <Card
                className={cn(
                  'flex items-center gap-3 p-4 transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-muted-foreground/30',
                )}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    isSelected
                      ? 'bg-primary/10 text-primary'
                      : 'bg-secondary text-muted-foreground',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span className="flex-1 text-sm font-medium">{idType.label}</span>
                <RadioGroupItem value={idType.key} id={idType.key} />
              </Card>
            </Label>
          );
        })}
      </RadioGroup>

      <Button
        onClick={handleContinue}
        disabled={!state.selectedIdType}
        className="w-full"
      >
        Continue
      </Button>
    </div>
  );
}
