'use client';

import React from 'react';
import { Building2, Landmark, FileText, ReceiptText } from 'lucide-react';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Card } from '../components/ui/card';
import { BusinessCountrySelect } from '../components/BusinessCountrySelect';
import { cn } from '../lib/utils';
import { useKYCContext } from '../context/KYCContext';
import { useKYCConfig } from '../context/KYCConfigContext';
import {
  businessCountriesFor,
  businessProductsForCountry,
  getBusinessProductDef,
} from '../lib/business';
import { hasActiveQuestionnaire } from '../lib/questionnaire';

const PRODUCT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  business: Building2,
  'business-tax': Landmark,
  'business-taxid': FileText,
  'business-tin': ReceiptText,
};

/**
 * Business (KYB) details step — replaces id-type/capture for business
 * workflows: pick a verification product (when the workflow offers more than
 * one), type the registration number (or TIN), and optionally the registered
 * business name. No camera, no liveness — the server runs a registry lookup.
 */
export function BusinessDetailsStep() {
  const { state, dispatch } = useKYCContext();
  const config = useKYCConfig();

  const business = config.business;
  // Registry country: workflows may offer several — the visitor picks theirs
  // (defaulting to the workflow's primary); products narrow per country.
  const offeredCountries = businessCountriesFor(business);
  const showCountryPicker = offeredCountries.length > 1;
  const country = state.business.country ?? business?.country ?? offeredCountries[0] ?? '';
  const offered = businessProductsForCountry(business, country);
  const showPicker = offered.length > 1;
  // Single-product countries skip the picker and use the only offered product.
  const pickedProduct =
    state.business.product && offered.includes(state.business.product) ? state.business.product : null;
  const product = showPicker ? pickedProduct : offered[0];
  const productDef = getBusinessProductDef(product ?? offered[0]!);

  const registrationNumber = state.business.registrationNumber;
  const registrationName = state.business.registrationName;
  const nameRequired = business?.requireRegistrationName === true;

  const numberValid = registrationNumber.trim().length >= 2;
  const isFormValid =
    !!product && numberValid && (!nameRequired || registrationName.trim() !== '');

  const setDetails = (payload: Partial<typeof state.business>) =>
    dispatch({ type: 'SET_BUSINESS_DETAILS', payload });

  const handleContinue = () => {
    if (!isFormValid) return;
    // Persist the resolved country + product so submission never re-derives them.
    if (product && (state.business.product !== product || state.business.country !== country)) {
      setDetails({ product, country });
    }
    if (hasActiveQuestionnaire(config.questionnaire)) {
      dispatch({ type: 'SET_STEP', payload: 'questionnaire' });
    } else {
      dispatch({ type: 'SUBMIT_VERIFICATION' });
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <StepHeader
        title="Business Details"
        description="Provide your business registration details for verification against the official registry."
        onBack={() => dispatch({ type: 'SET_STEP', payload: 'consent' })}
      />

      {showCountryPicker && (
        <div className="space-y-2">
          <Label htmlFor="businessCountry">Country of registration</Label>
          <BusinessCountrySelect
            id="businessCountry"
            countries={offeredCountries}
            value={country}
            onChange={(value) =>
              // A country switch can invalidate the picked product — reset it.
              setDetails({ country: value, product: null })
            }
          />
        </div>
      )}

      {showPicker && (
        <RadioGroup
          value={pickedProduct ?? ''}
          onValueChange={(value) => setDetails({ product: value })}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {offered.map((key) => {
            const def = getBusinessProductDef(key);
            const Icon = PRODUCT_ICONS[key] ?? Building2;
            const isSelected = pickedProduct === key;
            return (
              <Label key={key} htmlFor={`product-${key}`} className="cursor-pointer">
                <Card
                  className={cn(
                    'flex items-center gap-3 p-4 transition-colors',
                    isSelected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                      isSelected ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="flex-1 text-sm font-medium">{def.label}</span>
                  <RadioGroupItem value={key} id={`product-${key}`} />
                </Card>
              </Label>
            );
          })}
        </RadioGroup>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="registrationNumber">{productDef.inputLabel}</Label>
          <Input
            id="registrationNumber"
            placeholder={productDef.placeholder}
            value={registrationNumber}
            onChange={(e) => setDetails({ registrationNumber: e.target.value })}
            className={registrationNumber && !numberValid ? 'border-destructive' : ''}
          />
          {registrationNumber !== '' && !numberValid && (
            <p className="text-sm text-destructive">
              Enter a valid {productDef.inputLabel.toLowerCase()}.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="registrationName">
            Registered business name
            {!nameRequired && <span className="text-muted-foreground"> (optional)</span>}
          </Label>
          <Input
            id="registrationName"
            placeholder="Enter the registered business name"
            value={registrationName}
            onChange={(e) => setDetails({ registrationName: e.target.value })}
          />
        </div>
      </div>

      <Button onClick={handleContinue} disabled={!isFormValid} className="w-full">
        Continue
      </Button>
    </div>
  );
}
