'use client';

import React from 'react';
import { ChevronDown, MapPinCheck } from 'lucide-react';

// The presence-verification consent notice, shown on the address step when
// the workflow verifies presence over the coming days. Patterned on the
// consent artefact OkHi ships in production (accordion of plain-language
// disclosures, honest about location up front) — this is the screen a data
// protection review asks to see. Native <details> keeps it dependency-free.

const ROWS: Array<{ title: string; body: string }> = [
  {
    title: 'How it works',
    body: 'After you finish, your device periodically confirms it is at this address over the coming days. Only day-level summaries ever leave your phone, never your movements.',
  },
  {
    title: 'You stay in control',
    body: 'You can turn location off at any time in your device settings. An unfinished check simply expires. It never counts against you.',
  },
  {
    title: 'Your data is protected',
    body: "Location summaries are used only to confirm this address and are handled under your country's data protection rules.",
  },
];

export function PresenceNotice() {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20">
      <div className="flex items-center gap-2 border-b border-border/60 px-3.5 py-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <MapPinCheck className="h-3.5 w-3.5 text-primary" />
        </span>
        <p className="text-sm font-semibold">This address will be verified over the coming days</p>
      </div>
      {ROWS.map((row) => (
        <details key={row.title} className="group border-b border-border/60 last:border-b-0">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
            {row.title}
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <p className="px-3.5 pb-3 text-sm leading-snug text-muted-foreground">{row.body}</p>
        </details>
      ))}
    </div>
  );
}
