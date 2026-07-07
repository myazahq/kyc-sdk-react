'use client';

import React from 'react';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useKYCContext } from '../context/KYCContext';
import { useKYCConfig } from '../context/KYCConfigContext';
import { stepAfterCapture } from '../lib/post-capture';
import { validateIdNumber } from '../utils/validators';
import { ID_TYPES, isNumberOnlyIdType } from '../utils/countries';
import type { SupportedCountry } from '../types/config';

interface IdInputStepProps {
  country?: SupportedCountry;
}

export function IdInputStep({ country }: IdInputStepProps = {}) {
  const { state, dispatch } = useKYCContext();
  const config = useKYCConfig();

  const resolvedCountry: SupportedCountry = country ?? config.country ?? 'NG';

  const idTypeDef = state.selectedIdType
    ? (ID_TYPES[resolvedCountry] ?? []).find((t) => t.key === state.selectedIdType)
    : null;

  // What the field asks for — e.g. Tax ID is looked up by the person's NIN.
  const idLabel = idTypeDef?.inputLabel ?? idTypeDef?.label ?? 'ID Number';

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const hasFirstName = !!config.userData?.firstName;
  const hasLastName = !!config.userData?.lastName;
  const needsNameFields = !hasFirstName || !hasLastName;

  const idValidation = state.selectedIdType
    ? validateIdNumber(resolvedCountry, state.selectedIdType, state.idNumber)
    : { valid: state.idNumber.trim() !== '', message: '' };

  const isFormValid =
    state.idNumber.trim() !== '' &&
    idValidation.valid &&
    (hasFirstName || state.userData.firstName.trim() !== '') &&
    (hasLastName || state.userData.lastName.trim() !== '');

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const handleContinue = () => {
    if (!isFormValid) return;
    // Skip liveness when the org has it disabled for this ID — go straight
    // to the submission step.
    const features = state.selectedIdType
      ? config.getIdTypeFeatures(resolvedCountry, state.selectedIdType)
      : null;
    const skipLiveness =
      config.enableSelfie === false ||
      (features ? !features.livenessCheck : config.enableLiveness === false);
    dispatch({
      type: 'SET_STEP',
      payload: skipLiveness ? stepAfterCapture(config) : 'liveness',
    });
  };

  const handleBack = () => {
    // Number-only IDs (BVN/NIN/vNIN) came from id-type, not document-capture
    const prev = state.selectedIdType && isNumberOnlyIdType(state.selectedIdType)
      ? 'id-type'
      : 'document-capture';
    dispatch({ type: 'SET_STEP', payload: prev });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-5 animate-slide-up">
      <StepHeader
        title="Enter Your Details"
        description={`Provide your ${idLabel}${needsNameFields ? ' and personal information' : ''} for verification.`}
        onBack={handleBack}
        country={resolvedCountry}
      />

      <div className="space-y-4">
        {/* ID Number */}
        <div className="space-y-2">
          <Label htmlFor="idNumber">{idLabel}</Label>
          <Input
            id="idNumber"
            placeholder={
              idTypeDef?.digits
                ? `Enter ${idTypeDef.digits}-digit ${idLabel}`
                : `Enter your ${idLabel}`
            }
            value={state.idNumber}
            onChange={(e) => dispatch({ type: 'SET_ID_NUMBER', payload: e.target.value })}
            className={state.idNumber && !idValidation.valid ? 'border-destructive' : ''}
          />
          {state.idNumber && !idValidation.valid && idValidation.message && (
            <p className="text-sm text-destructive">{idValidation.message}</p>
          )}
        </div>

        {/* First Name + Last Name — only if not pre-provided by app */}
        {needsNameFields && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!hasFirstName && (
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="Enter your first name"
                  value={state.userData.firstName}
                  onChange={(e) =>
                    dispatch({ type: 'SET_USER_DATA', payload: { firstName: e.target.value } })
                  }
                />
              </div>
            )}

            {!hasLastName && (
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Enter your last name"
                  value={state.userData.lastName}
                  onChange={(e) =>
                    dispatch({ type: 'SET_USER_DATA', payload: { lastName: e.target.value } })
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>

      <Button
        onClick={handleContinue}
        disabled={!isFormValid}
        className="w-full"
      >
        Continue
      </Button>
    </div>
  );
}
