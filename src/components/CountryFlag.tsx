'use client';

import React from 'react';
import NG from 'country-flag-icons/react/3x2/NG';
import GH from 'country-flag-icons/react/3x2/GH';
import KE from 'country-flag-icons/react/3x2/KE';
import ZA from 'country-flag-icons/react/3x2/ZA';
import CI from 'country-flag-icons/react/3x2/CI';
import { cn } from '../lib/utils';

type FlagComponent = React.ComponentType<{
  title?: string;
  preserveAspectRatio?: string;
  className?: string;
}>;

// Only the supported countries are imported so the bundle doesn't pull in the
// full flag set. Mirrors the dashboard's CountryFlag component.
const FLAGS: Record<string, FlagComponent> = { NG, GH, KE, ZA, CI };

interface CountryFlagProps {
  code: string | null | undefined;
  className?: string;
  title?: string;
}

export function CountryFlag({ code, className, title }: CountryFlagProps) {
  if (!code) return null;
  const Flag = FLAGS[code.toUpperCase()];
  if (!Flag) return null;

  return (
    <span
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
      className={cn(
        'inline-block overflow-hidden rounded-full bg-muted shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] shrink-0 aspect-square',
        className,
      )}
    >
      <Flag
        title={title}
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full block object-cover"
      />
    </span>
  );
}
