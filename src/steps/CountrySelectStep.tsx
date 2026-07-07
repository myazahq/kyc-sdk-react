'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useKYCContext } from '../context/KYCContext';
import { useKYCConfig } from '../context/KYCConfigContext';
import { StepHeader } from '../components/StepHeader';
import { CountryFlag } from '../components/CountryFlag';
import type { SupportedCountry } from '../types/config';

const COUNTRY_NAMES: Record<SupportedCountry, string> = {
  NG: 'Nigeria',
  GH: 'Ghana',
  KE: 'Kenya',
  ZA: 'South Africa',
  CI: 'Côte d’Ivoire',
};

/**
 * Country selection for multi-region flows (config.countries has >1 entry).
 * Picking a country sets the session's EFFECTIVE country (the config provider
 * resolves it for every later step) and moves on to the ID-type list.
 */
export function CountrySelectStep() {
  const { state, dispatch } = useKYCContext();
  const config = useKYCConfig();

  const options = (config.countries ?? []).map((entry) => entry.country);
  const selected = state.selectedCountry ?? null;

  const pick = (country: SupportedCountry) => {
    dispatch({ type: 'SET_COUNTRY', payload: country });
    dispatch({ type: 'SET_STEP', payload: 'id-type' });
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <StepHeader
        title="Where was your ID issued?"
        description="Choose the country that issued your identity document."
        onBack={() => dispatch({ type: 'SET_STEP', payload: 'consent' })}
      />

      <div className="flex flex-col gap-2">
        {options.map((country) => (
          <button
            key={country}
            type="button"
            onClick={() => pick(country)}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors',
              selected === country
                ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                : 'border-border hover:border-primary/40 hover:bg-muted/40',
            )}
          >
            <span className="h-6 w-8 shrink-0 overflow-hidden rounded-sm shadow-sm ring-1 ring-black/10">
              <CountryFlag code={country} className="h-full w-full object-cover" />
            </span>
            <span className="flex-1 text-base font-medium">{COUNTRY_NAMES[country]}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}
