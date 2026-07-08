'use client';

import React from 'react';
import { MoveLeft } from 'lucide-react';
import { Button } from './ui/button';
import { CountryFlag } from './CountryFlag';
import { cn } from '../lib/utils';
import type { AnyCountry } from '../types/config';

interface StepHeaderProps {
  title: string;
  description?: string;
  onBack?: () => void;
  /** When set, a country flag is shown beside the title (any ISO-2 code —
   *  CountryFlag falls back to the emoji flag for unbundled SVGs). */
  country?: AnyCountry;
  className?: string;
}

export function StepHeader({ title, description, onBack, country, className }: StepHeaderProps) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      {onBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="shrink-0 -ml-2 mt-0.5"
          aria-label="Go back"
        >
          <MoveLeft className="h-5 w-5" />
        </Button>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold leading-tight font-heading">{title}</h2>
          {country && <CountryFlag code={country} title={country} className="h-5 w-5" />}
        </div>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}
