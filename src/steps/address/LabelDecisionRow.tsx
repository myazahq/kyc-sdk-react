'use client';

import React from 'react';
import { MapPinned } from 'lucide-react';
import { Button } from '../../components/ui/button';

interface LabelDecisionRowProps {
  /** The picked address line under question. */
  label: string;
  onKeep: () => void;
  onAdopt: () => void;
}

/**
 * The keep/update decision after a pin move (user decision 2026-08-30): a
 * picked address is never silently replaced by a reverse geocode, and never
 * silently kept against the applicant's wishes either — they choose. Rendered
 * on the pin step only while the question is open (shouldAskLabelDecision).
 */
export function LabelDecisionRow({ label, onKeep, onAdopt }: LabelDecisionRowProps) {
  return (
    <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/[0.05] px-3.5 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <MapPinned className="h-4 w-4 text-primary" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">You moved the pin</p>
          <p className="text-xs leading-snug text-muted-foreground">
            Keep <span className="font-medium text-foreground">{label}</span> as your address, or
            update it to match the new spot?
          </p>
        </div>
      </div>
      <div className="flex gap-2 pl-11">
        <Button onClick={onKeep} className="h-8 rounded-lg px-3 text-xs font-medium">
          Keep this address
        </Button>
        <Button variant="outline" onClick={onAdopt} className="h-8 rounded-lg px-3 text-xs font-medium">
          Use the pin&rsquo;s address
        </Button>
      </div>
    </div>
  );
}
