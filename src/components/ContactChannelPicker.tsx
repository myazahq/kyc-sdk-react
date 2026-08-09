'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Card } from './ui/card';
import { cn } from '../lib/utils';
import { channelLabel, type PhoneOtpChannel } from '../lib/contact-channels';

const PRESENTATION: Record<PhoneOtpChannel, { hint: string; icon: React.ComponentType<{ className?: string }> }> = {
  sms: { hint: 'Text message', icon: MessageSquare },
  whatsapp: { hint: 'Needs WhatsApp installed', icon: WhatsAppIcon },
};

/**
 * How the user wants their code delivered.
 *
 * Only rendered when the workflow offers more than one channel — with a single
 * channel there is no choice to make, and a one-option picker is just noise.
 * The org decides WHICH channels are on offer; the person receiving the code
 * decides between them, because only they know whether they have WhatsApp or
 * whether their SMS is reliable today.
 */
export function ContactChannelPicker({
  offered,
  picked,
  onPick,
  disabled,
}: {
  offered: PhoneOtpChannel[];
  picked: PhoneOtpChannel;
  onPick: (channel: PhoneOtpChannel) => void;
  disabled?: boolean;
}) {
  if (offered.length < 2) return null;

  return (
    <div className="space-y-2">
      <Label>How should we send it?</Label>
      <RadioGroup
        value={picked}
        onValueChange={(v) => onPick(v as PhoneOtpChannel)}
        disabled={disabled}
        className="grid grid-cols-2 gap-3"
      >
        {offered.map((key) => {
          const { hint, icon: Icon } = PRESENTATION[key];
          const label = channelLabel(key);
          const isSelected = picked === key;
          return (
            <Label key={key} htmlFor={`otp-channel-${key}`} className="cursor-pointer">
              <Card
                className={cn(
                  'flex items-center gap-3 p-3 transition-colors',
                  isSelected ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30',
                )}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    isSelected ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{hint}</span>
                </span>
                <RadioGroupItem value={key} id={`otp-channel-${key}`} />
              </Card>
            </Label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
