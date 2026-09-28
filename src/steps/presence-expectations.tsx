'use client';

import React from 'react';
import { BellRing, MapPinCheck, Radar } from '../components/icons';
import { cn } from '../lib/utils';
import { useText, type TextFn } from '../i18n';

// The success screen's presence card, drawn as a LIVE process rather than a
// notice: a pulsing "active" badge (the check began the moment they submitted)
// and three milestones on a progress track — the first one filled and beating,
// the later ones waiting their turn. The card should feel like something is
// already quietly working, because it is.

const milestones = (t: TextFn): Array<{
  Icon: typeof BellRing;
  stage: string;
  title: string;
  caption: string;
  state: 'active' | 'ahead';
}> => [
  {
    Icon: MapPinCheck,
    stage: t('address.presence.step1.stage'),
    title: t('address.presence.step1.title'),
    caption: t('address.presence.step1.caption'),
    state: 'active',
  },
  {
    Icon: Radar,
    stage: t('address.presence.step2.stage'),
    title: t('address.presence.step2.title'),
    caption: t('address.presence.step2.caption'),
    state: 'ahead',
  },
  {
    Icon: BellRing,
    stage: t('address.presence.step3.stage'),
    title: t('address.presence.step3.title'),
    caption: t('address.presence.step3.caption'),
    state: 'ahead',
  },
];

export function PresenceExpectations() {
  const t = useText();
  const MILESTONES = milestones(t);
  return (
    <div className="overflow-hidden rounded-2xl border border-primary/15 text-left">
      {/* Header band: alive, not archival. */}
      <div className="space-y-1 bg-primary/[0.06] px-4 pb-3 pt-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
          <span className="relative flex h-2 w-2">
            <span className="absolute h-2 w-2 rounded-full bg-primary/60 animate-ping" />
            <span className="relative h-2 w-2 rounded-full bg-primary" />
          </span>
          {t('address.presence.badge')}
        </span>
        <p className="text-sm font-semibold">{t('address.presence.title')}</p>
        <p className="text-xs text-muted-foreground">{t('address.presence.description')}</p>
      </div>

      {/* The track: vertical rail on phones, three-up on wider screens. */}
      <div className="grid gap-0 px-4 py-4 sm:grid-cols-3 sm:gap-3">
        {MILESTONES.map(({ Icon, stage, title, caption, state }, i) => (
          <div key={title} className="relative flex gap-3 pb-4 last:pb-0 sm:flex-col sm:gap-2 sm:pb-0">
            {/* Connector: down the rail on mobile, across the top on desktop. */}
            {i < MILESTONES.length - 1 && (
              <>
                <span className="absolute bottom-0 left-[15px] top-9 w-px bg-border sm:hidden" aria-hidden />
                <span
                  className="absolute left-10 right-[-0.75rem] top-4 hidden h-px border-t border-dashed border-border sm:block"
                  aria-hidden
                />
              </>
            )}
            <span
              className={cn(
                'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                state === 'active'
                  ? 'bg-primary text-primary-foreground shadow-[0_0_0_4px] shadow-primary/15'
                  : 'bg-muted text-muted-foreground ring-1 ring-border',
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 pt-0.5 sm:pt-0">
              <span
                className={cn(
                  'block text-[10px] font-semibold uppercase tracking-wider',
                  state === 'active' ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {stage}
              </span>
              <span className="block text-sm font-medium leading-tight">{title}</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{caption}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
