'use client';

import React from 'react';
import { CheckCircle2, Loader2, Upload, X } from 'lucide-react';
import { UploadedFileThumb } from '../components/UploadedFilePreview';
import { CountryFlag } from '../components/CountryFlag';
import { regionCountryName } from '../lib/regions';

// Proof of Address — the two states of the attachment area, split out of the
// step (200-line rule; mirrors RN's ProofOfAddressParts and Flutter's
// proof_of_address_parts). Pure presentation: the step owns the picking,
// uploading and removing.
//
// Both states carry the country the document is for (user decision
// 2026-09-05): the flag before the call to action on the drop zone, and before
// the document kind on the uploaded row, so a person on a multi-market flow
// sees which market the paper is being read against. Null when the flow does
// not know it yet (the address scope before a pick) — nothing is invented.

function Flag({ country, className }: { country: string | null; className: string }) {
  if (!country) return null;
  return <CountryFlag code={country} className={className} title={regionCountryName(country)} />;
}

export function PoaUploadedRow({
  pickedFile,
  fileName,
  typeLabel,
  country,
  onRemove,
}: {
  pickedFile: File | null;
  fileName: string | null;
  typeLabel: string;
  country: string | null;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
      {pickedFile ? (
        <UploadedFileThumb file={pickedFile} label={typeLabel} />
      ) : (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--kyc-success,#0DA211)]" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{fileName || 'Document uploaded'}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Flag country={country} className="h-4 w-4 shrink-0" />
          <span className="truncate">{typeLabel}</span>
        </p>
      </div>
      <button
        type="button"
        aria-label="Remove document"
        onClick={onRemove}
        className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** The DASHED drop zone that NAMES the document being asked for. */
export function PoaDropzone({
  uploading,
  typeLabel,
  country,
  onPress,
}: {
  uploading: boolean;
  typeLabel: string;
  country: string | null;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      disabled={uploading}
      onClick={onPress}
      className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
    >
      {uploading ? (
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      ) : (
        <Upload className="h-8 w-8 text-muted-foreground" />
      )}
      <span className="flex items-center gap-2 text-sm font-medium">
        <Flag country={country} className="h-5 w-5 shrink-0" />
        {uploading ? 'Uploading…' : `Upload your ${typeLabel.toLowerCase()}`}
      </span>
      <span className="text-xs text-muted-foreground">Photo or PDF, up to 20MB</span>
    </button>
  );
}
