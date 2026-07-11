'use client';

import React from 'react';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { BusinessCountrySelect } from '../components/BusinessCountrySelect';
import { BusinessProductPicker } from '../components/BusinessProductPicker';
import { BusinessContactEmailField } from '../components/BusinessContactEmailField';
import { BusinessCompanyInfoFields } from '../components/BusinessCompanyInfoFields';
import { useKYCContext } from '../context/KYCContext';
import { useKYCConfig } from '../context/KYCConfigContext';
import {
  businessCountriesFor,
  businessProductsForCountry,
  companyInfoFieldModes,
  getBusinessProductDef,
  isValidContactEmail,
  keyPeopleNeedsContactEmail,
} from '../lib/business';
import { nextBusinessStep } from '../lib/business-application';
import { registrationNumberHint } from '../lib/registration-hint';

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

  // Key-people email invites: optional, but format-validated when typed.
  const showContactEmail = keyPeopleNeedsContactEmail(business);
  const contactEmail = state.business.contactEmail;
  const emailValid = contactEmail.trim() === '' || isValidContactEmail(contactEmail.trim());

  // Company profile (address / email / phone / website): per-field modes from
  // the workflow config; the address is registry-cross-checked server-side
  // (business.addressMatch). Required fields block Continue.
  const infoModes = companyInfoFieldModes(business);
  const showCompanyInfo = Object.values(infoModes).some((m) => m !== 'off');
  const businessEmailValid =
    state.business.email.trim() === '' || isValidContactEmail(state.business.email.trim());
  const companyInfoComplete = (['address', 'email', 'phone', 'website'] as const).every(
    (f) => infoModes[f] !== 'required' || state.business[f].trim() !== '',
  );

  // Country-aware registration-number guidance (NG: CAC prefix rules +
  // format validation; elsewhere: a generic registry tip).
  const regHint = registrationNumberHint(country, productDef);
  const formatOk =
    !regHint.isValidFormat ||
    registrationNumber.trim() === '' ||
    regHint.isValidFormat(registrationNumber);
  const numberValid = registrationNumber.trim().length >= 2 && formatOk;
  const isFormValid =
    !!product &&
    numberValid &&
    (!nameRequired || registrationName.trim() !== '') &&
    (!showContactEmail || emailValid) &&
    (!showCompanyInfo || (businessEmailValid && companyInfoComplete));

  const setDetails = (payload: Partial<typeof state.business>) =>
    dispatch({ type: 'SET_BUSINESS_DETAILS', payload });

  const handleContinue = () => {
    if (!isFormValid) return;
    // Persist the resolved country + product so submission never re-derives them.
    if (product && (state.business.product !== product || state.business.country !== country)) {
      setDetails({ product, country });
    }
    // KYB application steps (key people / documents / applicant), then the
    // questionnaire, then submission — the sequencing lives in one helper.
    const next = nextBusinessStep('business-details', config);
    if (next === 'submitted') {
      dispatch({ type: 'SUBMIT_VERIFICATION' });
    } else {
      dispatch({ type: 'SET_STEP', payload: next });
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
        <BusinessProductPicker
          offered={offered}
          picked={pickedProduct}
          onPick={(value) => setDetails({ product: value })}
        />
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="registrationNumber">{productDef.inputLabel}</Label>
          <Input
            id="registrationNumber"
            placeholder={regHint.placeholder}
            value={registrationNumber}
            onChange={(e) => setDetails({ registrationNumber: e.target.value })}
            className={registrationNumber && !numberValid ? 'border-destructive' : ''}
          />
          {registrationNumber !== '' && !numberValid ? (
            <p className="text-sm text-destructive">
              {!formatOk && regHint.formatError
                ? regHint.formatError
                : `Enter a valid ${productDef.inputLabel.toLowerCase()}.`}
            </p>
          ) : (
            regHint.tip && <p className="text-xs text-muted-foreground">{regHint.tip}</p>
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

        {showCompanyInfo && (
          <BusinessCompanyInfoFields
            values={{
              address: state.business.address,
              email: state.business.email,
              phone: state.business.phone,
              website: state.business.website,
            }}
            modes={infoModes}
            emailValid={businessEmailValid}
            onChange={(patch) => setDetails(patch)}
          />
        )}

        {showContactEmail && (
          <BusinessContactEmailField
            value={contactEmail}
            valid={emailValid}
            onChange={(value) => setDetails({ contactEmail: value })}
          />
        )}
      </div>

      <Button onClick={handleContinue} disabled={!isFormValid} className="w-full">
        Continue
      </Button>
    </div>
  );
}
