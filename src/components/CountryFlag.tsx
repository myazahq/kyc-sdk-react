'use client';

import React from 'react';
import * as Flags from 'country-flag-icons/react/3x2';
import { cn } from '../lib/utils';

type FlagComponent = React.ComponentType<{
  title?: string;
  preserveAspectRatio?: string;
  className?: string;
}>;

// The full ISO SVG flag set (same as the dashboard's CountryFlag). Global
// Documents let the country-select step render ANY of ~200 countries, so a
// curated subset would drop to the emoji fallback for most of them — importing
// the whole set keeps every flag a real, circular SVG.
const FLAGS = Flags as unknown as Record<string, FlagComponent>;

/** Flag country code for a money-question currency (XOF → Côte d'Ivoire).
 *  Most ISO-4217 codes derive as their first two letters (JPY→JP, INR→IN);
 *  the map covers the ones that don't. */
export function currencyFlagCode(currency: string): string {
  const map: Record<string, string> = {
    NGN: 'NG', USD: 'US', GHS: 'GH', KES: 'KE', ZAR: 'ZA', XOF: 'CI', EUR: 'EU', GBP: 'GB',
    XAF: 'CM', XCD: 'AG', ANG: 'CW', CHF: 'CH',
  };
  return map[currency.toUpperCase()] ?? currency.slice(0, 2).toUpperCase();
}

interface CountryFlagProps {
  code: string | null | undefined;
  className?: string;
  title?: string;
}

export function CountryFlag({ code, className, title }: CountryFlagProps) {
  if (!code) return null;
  const upper = code.toUpperCase();
  const Flag = FLAGS[upper];
  if (!Flag) {
    // A code outside the bundled SVG set (the server catalogue can grow)
    // degrades to the emoji flag INSIDE the same circular badge, so fallbacks
    // stay visually consistent with the SVG flags around them.
    if (!/^[A-Z]{2}$/.test(upper)) return null;
    const emoji = String.fromCodePoint(...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
    return (
      <span
        role={title ? 'img' : undefined}
        aria-label={title}
        aria-hidden={title ? undefined : true}
        className={cn(
          'inline-flex items-center justify-center overflow-hidden rounded-full bg-muted shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] shrink-0 aspect-square leading-none',
          className,
        )}
      >
        <span aria-hidden className="block scale-[1.6] text-[0.6em]">
          {emoji}
        </span>
      </span>
    );
  }

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
