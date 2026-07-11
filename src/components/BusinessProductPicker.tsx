'use client';

import React from 'react';
import { Building2, Landmark, FileText, ReceiptText } from 'lucide-react';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Card } from './ui/card';
import { cn } from '../lib/utils';
import { getBusinessProductDef } from '../lib/business';

const PRODUCT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  business: Building2,
  'business-tax': Landmark,
  'business-taxid': FileText,
  'business-tin': ReceiptText,
};

/** Product cards on the business-details step (shown when >1 is offered). */
export function BusinessProductPicker({
  offered,
  picked,
  onPick,
}: {
  offered: string[];
  picked: string | null;
  onPick: (product: string) => void;
}) {
  return (
    <RadioGroup
      value={picked ?? ''}
      onValueChange={onPick}
      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      {offered.map((key) => {
        const def = getBusinessProductDef(key);
        const Icon = PRODUCT_ICONS[key] ?? Building2;
        const isSelected = picked === key;
        return (
          <Label key={key} htmlFor={`product-${key}`} className="cursor-pointer">
            <Card
              className={cn(
                'flex items-center gap-3 p-4 transition-colors',
                isSelected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30',
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                  isSelected ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="flex-1 text-sm font-medium">{def.label}</span>
              <RadioGroupItem value={key} id={`product-${key}`} />
            </Card>
          </Label>
        );
      })}
    </RadioGroup>
  );
}
