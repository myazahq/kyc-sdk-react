'use client';

import React, { useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, Upload, X } from 'lucide-react';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/ui/button';
import { useKYCContext } from '../context/KYCContext';
import { useKYCConfig } from '../context/KYCConfigContext';
import { isNumberOnlyIdType } from '../utils/countries';
import { hasActiveQuestionnaire } from '../lib/questionnaire';
import { cn } from '../lib/utils';
import type { PoaDocumentType } from '../types/config';

const TYPE_LABELS: Record<PoaDocumentType, string> = {
  utility_bill: 'Utility bill',
  bank_statement: 'Bank statement',
  tenancy_agreement: 'Tenancy agreement',
  other: 'Other document',
};

const ALL_TYPES: PoaDocumentType[] = ['utility_bill', 'bank_statement', 'tenancy_agreement', 'other'];
const ACCEPTED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Proof of Address: the user picks the document kind and uploads a recent
 * utility bill / bank statement / tenancy document (photo or PDF). The server
 * reads it asynchronously (name match + recency) — the SDK only collects it.
 */
export function ProofOfAddressStep() {
  const { state, dispatch } = useKYCContext();
  const config = useKYCConfig();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offeredTypes =
    config.proofOfAddress?.documentTypes && config.proofOfAddress.documentTypes.length > 0
      ? config.proofOfAddress.documentTypes
      : ALL_TYPES;
  const selectedType = state.poaDocumentType ?? offeredTypes[0]!;
  const maxAgeDays = config.proofOfAddress?.maxAgeDays ?? 90;
  const uploaded = Boolean(state.mediaIds.proofOfAddress);

  const handleFile = async (file: File) => {
    setError(null);
    if (!ACCEPTED_MIMES.includes((file.type.split(';')[0] || '').toLowerCase())) {
      setError('Please upload a photo (JPEG/PNG/WebP) or a PDF.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('File is too large (max 20MB).');
      return;
    }
    setUploading(true);
    try {
      const mediaId = await config.api.upload(file, 'proof_of_address');
      dispatch({ type: 'SET_MEDIA_ID', payload: { mediaType: 'proofOfAddress', mediaId } });
      dispatch({
        type: 'SET_POA_DOCUMENT',
        payload: { documentType: selectedType, fileName: file.name },
      });
    } catch {
      setError('Upload failed. Please check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleBack = () => {
    const backTo =
      config.enableSelfie !== false
        ? 'liveness'
        : state.selectedIdType && isNumberOnlyIdType(state.selectedIdType)
          ? 'id-input'
          : 'document-capture';
    dispatch({ type: 'SET_STEP', payload: backTo });
  };

  const handleContinue = () => {
    if (hasActiveQuestionnaire(config.questionnaire)) {
      dispatch({ type: 'SET_STEP', payload: 'questionnaire' });
    } else {
      dispatch({ type: 'SUBMIT_VERIFICATION' });
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <StepHeader
        title="Proof of address"
        description={`Upload a document that shows your name and home address, issued within the last ${maxAgeDays} days.`}
        onBack={handleBack}
      />

      {offeredTypes.length > 1 && (
        <div className="flex flex-col gap-2">
          {offeredTypes.map((type) => (
            <button
              key={type}
              type="button"
              disabled={uploaded}
              onClick={() =>
                dispatch({
                  type: 'SET_POA_DOCUMENT',
                  payload: { documentType: type, fileName: state.poaFileName ?? '' },
                })
              }
              className={cn(
                'flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors',
                selectedType === type
                  ? 'border-primary bg-primary/5 font-medium'
                  : 'border-border hover:bg-muted/40',
                uploaded && 'opacity-60',
              )}
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIMES.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />

      {uploaded ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--kyc-success,#0DA211)]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{state.poaFileName || 'Document uploaded'}</p>
            <p className="text-xs text-muted-foreground">{TYPE_LABELS[selectedType]}</p>
          </div>
          <button
            type="button"
            aria-label="Remove document"
            onClick={() => dispatch({ type: 'CLEAR_POA_DOCUMENT' })}
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">
            {uploading ? 'Uploading…' : `Upload your ${TYPE_LABELS[selectedType].toLowerCase()}`}
          </span>
          <span className="text-xs text-muted-foreground">Photo or PDF, up to 20MB</span>
        </button>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        onClick={handleContinue}
        disabled={!uploaded || uploading}
        className="w-full h-12 rounded-xl text-base font-medium"
      >
        Continue
      </Button>
    </div>
  );
}
