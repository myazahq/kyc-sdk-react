'use client';

import React, { useState } from 'react';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/ui/button';
import { useKYCContext } from '../context/KYCContext';
import { useKYCConfig } from '../context/KYCConfigContext';
import { hasProofOfAddressStep } from '../lib/post-capture';
import { isBusinessFlow } from '../lib/business';
import { QuestionField } from './QuestionnaireFields';
import type { QuestionnaireAnswerValue } from '../types/config';

/**
 * Extra-info questionnaire (compliance declarations — income, source of funds,
 * …), shown after capture, right before submission. Fields come from the
 * workflow config; answers ride the /verify submission and are re-validated
 * server-side against the published definition. Money questions store two
 * keys: `<key>` (amount) + `<key>_currency`.
 */
export function QuestionnaireStep() {
  const { state, dispatch } = useKYCContext();
  const config = useKYCConfig();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const questionnaire = config.questionnaire;
  const fields = questionnaire?.fields ?? [];
  const answers = state.questionnaireAnswers;

  const setAnswer = (key: string, value: QuestionnaireAnswerValue | undefined) => {
    dispatch({ type: 'SET_QUESTIONNAIRE_ANSWER', payload: { key, value } });
    setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev));
  };

  const handleBack = () => {
    // Mirror the forward path: business details for KYB flows; otherwise Proof
    // of Address when it ran, else liveness, else the capture step.
    const backTo = isBusinessFlow(config)
      ? 'business-details'
      : hasProofOfAddressStep(config.proofOfAddress)
        ? 'proof-of-address'
        : config.enableSelfie !== false
          ? 'liveness'
          : state.selectedIdType &&
              config.getIdTypeDefinition(state.selectedIdType)?.requiresDocumentCapture === false
            ? 'id-input'
            : 'document-capture';
    dispatch({ type: 'SET_STEP', payload: backTo });
  };

  const handleContinue = () => {
    const nextErrors: Record<string, string> = {};
    for (const field of fields) {
      const value = answers[field.key];
      const empty =
        value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
      if (field.required && empty) {
        nextErrors[field.key] = 'This field is required.';
        continue;
      }
      if ((field.type === 'number' || field.type === 'money') && !empty) {
        const num = Number(value);
        if (!Number.isFinite(num) || (field.type === 'money' && num < 0)) {
          nextErrors[field.key] = field.type === 'money' ? 'Enter a valid amount.' : 'Enter a valid number.';
        } else if (field.min !== undefined && num < field.min) {
          nextErrors[field.key] = `Must be at least ${field.min.toLocaleString()}.`;
        } else if (field.max !== undefined && num > field.max) {
          nextErrors[field.key] = `Must be at most ${field.max.toLocaleString()}.`;
        }
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    // Money answers always carry their currency companion — default the
    // definition's first currency when the user never touched the picker.
    for (const field of fields) {
      if (field.type !== 'money') continue;
      if (answers[field.key] !== undefined && answers[`${field.key}_currency`] === undefined) {
        const fallback = field.currencies?.[0];
        if (fallback) setAnswer(`${field.key}_currency`, fallback);
      }
    }
    dispatch({ type: 'SUBMIT_VERIFICATION' });
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <StepHeader
        title={questionnaire?.title ?? 'A few more questions'}
        description={
          questionnaire?.description ??
          'This information is required for compliance and helps keep your account safe.'
        }
        onBack={handleBack}
      />

      <div className="flex flex-col gap-4">
        {fields.map((field) => (
          <QuestionField
            key={field.key}
            field={field}
            value={answers[field.key]}
            currencyValue={answers[`${field.key}_currency`] as string | undefined}
            error={errors[field.key]}
            onChange={(value) => setAnswer(field.key, value)}
            onCurrencyChange={(currency) => setAnswer(`${field.key}_currency`, currency)}
          />
        ))}
      </div>

      <Button onClick={handleContinue} className="w-full h-12 rounded-xl text-base font-medium">
        Continue
      </Button>
    </div>
  );
}
