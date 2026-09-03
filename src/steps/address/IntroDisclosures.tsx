'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * The intro screen's three plain-language disclosures (the OkHi-patterned
 * consent copy a data protection review asks to see), as a SMOOTHLY animated
 * single-open accordion — the grid-rows technique, since native <details>
 * cannot animate height. Split from AddressIntroGate per the 200-line rule.
 */
const HOW_IT_WORKS = {
  foreground:
    'After you finish, your device periodically confirms it is at this address over the coming days. Only day-level summaries ever leave your phone, never your movements.',
  background:
    'After you finish, your phone confirms it is at this address over the coming days, even when the app is closed. Only day-level summaries ever leave your phone, never your movements.',
} as const;

const disclosuresFor = (
  background: boolean,
): Array<{ Icon: typeof HelpCircle; title: string; body: string }> => [
  {
    Icon: HelpCircle,
    title: 'How it works',
    body: background ? HOW_IT_WORKS.background : HOW_IT_WORKS.foreground,
  },
  {
    Icon: SlidersHorizontal,
    title: 'You stay in control',
    body: 'You can turn location off at any time in your device settings. An unfinished check simply expires. It never counts against you.',
  },
  {
    Icon: ShieldCheck,
    title: 'Your data is protected',
    body: "Location summaries are used only to confirm this address and are handled under your country's data protection rules.",
  },
];

export function IntroDisclosures({
  background = false,
}: {
  /** The workflow opts into OS geofencing: the copy says the app can be closed. */
  background?: boolean;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const DISCLOSURES = disclosuresFor(background);
  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      {DISCLOSURES.map(({ Icon, title, body }, i) => {
        const open = openIdx === i;
        return (
          <div key={title} className="border-b border-border/60 last:border-b-0">
            <button
              type="button"
              onClick={() => setOpenIdx(open ? null : i)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted/40"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-300',
                    open ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium">{title}</span>
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out',
                  open && 'rotate-180',
                )}
              />
            </button>
            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-300 ease-out',
                open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <p
                  className={cn(
                    'px-3.5 pb-3.5 pl-[3.1rem] text-sm leading-relaxed text-muted-foreground transition-opacity duration-300',
                    open ? 'opacity-100' : 'opacity-0',
                  )}
                >
                  {body}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
