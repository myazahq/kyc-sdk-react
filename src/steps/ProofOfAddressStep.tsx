'use client';

import React, { useRef, useState } from 'react';
import { PoaDocumentTypeList } from './PoaDocumentTypeList';
import { PoaDropzone, PoaUploadedRow } from './ProofOfAddressParts';
import { StepHeader } from '../components/StepHeader';
import { AddressCountryControl } from './address/AddressCountryControl';
import { Button } from '../components/ui/button';
import { useKYCContext } from '../context/KYCContext';
import { useKYCConfig } from '../context/KYCConfigContext';
import { poaOfferedKinds, stepAfterProofOfAddress } from '../lib/post-capture';
import { lastContactStep } from '../lib/contact-steps';
import type { PoaDocumentType } from '../types/config';

const TYPE_LABELS: Record<PoaDocumentType, string> = {
  utility_bill: 'Utility bill',
  bank_statement: 'Bank statement',
  tenancy_agreement: 'Tenancy agreement',
  other: 'Other document',
};

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
  // In-memory File for tap-to-preview (lost on remount — row degrades cleanly).
  const [pickedFile, setPickedFile] = useState<File | null>(null);

  // Per-country overrides (the builder matrix's row cells) narrow the offer;
  // config.country is the EFFECTIVE country, so on the address scope the
  // declared-country pick re-derives this live.
  const offeredTypes = poaOfferedKinds(config.proofOfAddress, config.country);
  const selectedType = state.poaDocumentType ?? offeredTypes[0]!;
  // The org can rename the 'other' kind in the workflow builder (e.g. "Council
  // tax letter"); fall back to the generic label when unset.
  const labelFor = (type: PoaDocumentType) =>
    type === 'other' && config.proofOfAddress?.otherLabel?.trim()
      ? config.proofOfAddress.otherLabel.trim()
      : TYPE_LABELS[type];
  const maxAgeDays = config.proofOfAddress?.maxAgeDays ?? 90;
  const uploaded = Boolean(state.mediaIds.proofOfAddress);
  // The flag on the attachment area: on the address scope only a country the
  // applicant picked (the scope has no seeded country to show), else the
  // flow's effective country.
  const flagCountry =
    config.scope === 'address' ? (state.selectedCountry ?? null) : (config.country ?? null);

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
      setPickedFile(file);
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
      config.scope === 'address'
        ? lastContactStep(config)
        : config.enableSelfie !== false
        ? 'liveness'
        : state.selectedIdType &&
            config.getIdTypeDefinition(state.selectedIdType)?.requiresDocumentCapture === false
          ? 'id-input'
          : 'document-capture';
    dispatch({ type: 'SET_STEP', payload: backTo });
  };

  const handleContinue = () => {
    const next = stepAfterProofOfAddress(config);
    dispatch(next === 'submitted' ? { type: 'SUBMIT_VERIFICATION' } : { type: 'SET_STEP', payload: next });
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <StepHeader
        title="Proof of address"
        description={`Upload a document that shows your name and home address, issued within the last ${maxAgeDays} days.`}
        onBack={handleBack}
      />

      {/* Address scope only (renders null elsewhere): the applicant declares
          their country before the document — the Didit PoA model. It follows
          the whole flow: the search filter, the map, the vendor market, and
          the submission's country. */}
      <AddressCountryControl />

      {offeredTypes.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <span id="poa-document-type-label" className="text-sm font-semibold">
            Document type
          </span>
          <PoaDocumentTypeList
            labelledBy="poa-document-type-label"
            value={selectedType}
            options={offeredTypes.map((type) => ({ value: type, label: labelFor(type) }))}
            // Locked once a file is attached: switching the kind afterwards
            // would mislabel the document already uploaded. Same rule as RN.
            disabled={uploaded}
            onChange={(type) =>
              dispatch({
                type: 'SET_POA_DOCUMENT',
                payload: { documentType: type, fileName: state.poaFileName ?? '' },
              })
            }
          />
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
        <PoaUploadedRow
          pickedFile={pickedFile}
          fileName={state.poaFileName}
          typeLabel={labelFor(selectedType)}
          country={flagCountry}
          onRemove={() => {
            setPickedFile(null);
            dispatch({ type: 'CLEAR_POA_DOCUMENT' });
          }}
        />
      ) : (
        <PoaDropzone
          uploading={uploading}
          typeLabel={labelFor(selectedType)}
          country={flagCountry}
          onPress={() => inputRef.current?.click()}
        />
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
