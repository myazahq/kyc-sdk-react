'use client';

import React from 'react';
import { MessageSquare } from './icons';
import { WhatsAppIcon } from './WhatsAppIcon';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Card } from './ui/card';
import { cn } from '../lib/utils';
import type { PhoneOtpChannel } from '../lib/contact-channels';
import { useText, type TextFn } from '../i18n';

const PRESENTATION: Record<PhoneOtpChannel, { name: string; hint: string; icon: React.ComponentType<{ className?: string }> }> = {
  sms: { name: 'contact.channel.sms', hint: 'contact.channel.smsHint', icon: MessageSquare },
  whatsapp: { name: 'contact.channel.whatsapp', hint: 'contact.channel.whatsappHint', icon: WhatsAppIcon },
};

/** A channel's display name ("SMS", "WhatsApp") from the text catalogue. */
export function channelName(channel: PhoneOtpChannel, t: TextFn): string {
  return t(PRESENTATION[channel]?.name ?? 'contact.channel.sms');
}

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
  const t = useText();
  if (offered.length < 2) return null;

  return (
    <div className="space-y-2">
      <Label>{t('contact.channel.question')}</Label>
      <RadioGroup
        value={picked}
        onValueChange={(v) => onPick(v as PhoneOtpChannel)}
        disabled={disabled}
        className="grid grid-cols-2 gap-3"
      >
        {offered.map((key) => {
          const { hint, icon: Icon } = PRESENTATION[key];
          const label = channelName(key, t);
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
                  <span className="block truncate text-xs text-muted-foreground">{t(hint)}</span>
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
