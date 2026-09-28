'use client';

import React, { useState } from 'react';
import { ChevronDown, CircleHelp, ShieldCheck, SlidersHorizontal } from '../../components/icons';
import { cn } from '../../lib/utils';
import { useText, type TextFn } from '../../i18n';

/**
 * The intro screen's three plain-language disclosures (the OkHi-patterned
 * consent copy a data protection review asks to see), as a SMOOTHLY animated
 * single-open accordion — the grid-rows technique, since native <details>
 * cannot animate height. Split from AddressIntroGate per the 200-line rule.
 */
const disclosuresFor = (
  background: boolean,
  t: TextFn,
): Array<{ Icon: typeof CircleHelp; title: string; body: string }> => [
  {
    Icon: CircleHelp,
    title: t('address.intro.howItWorks.title'),
    body: t(background ? 'address.intro.howItWorks.body.background' : 'address.intro.howItWorks.body'),
  },
  {
    Icon: SlidersHorizontal,
    title: t('address.intro.control.title'),
    body: t('address.intro.control.body'),
  },
  {
    Icon: ShieldCheck,
    title: t('address.intro.privacy.title'),
    body: t('address.intro.privacy.body'),
  },
];

export function IntroDisclosures({
  background = false,
}: {
  /** The workflow opts into OS geofencing: the copy says the app can be closed. */
  background?: boolean;
}) {
  const t = useText();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const DISCLOSURES = disclosuresFor(background, t);
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
