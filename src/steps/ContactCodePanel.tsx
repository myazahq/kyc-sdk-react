'use client';

import React from 'react';
import { ContactCodeEntry } from './ContactCodeEntry';
import { ExpiryCountdown } from '../components/ExpiryCountdown';
import { channelLabel, type PhoneOtpChannel } from '../lib/contact-channels';
import type { OtpInputStyle } from '../types/config';

/**
 * The code-entry half of the contact step: the digits, the countdown, and the
 * two ways out of a code that never arrived — resend, or try the other channel.
 */
export function ContactCodePanel({
  code,
  onChange,
  onComplete,
  codeLength,
  style,
  expiresAt,
  onResend,
  otherChannel,
  disabled,
}: {
  code: string;
  onChange: (code: string) => void;
  onComplete: (code: string) => void;
  codeLength: number;
  style: OtpInputStyle;
  expiresAt: string | null;
  onResend: (switchTo?: PhoneOtpChannel) => void;
  /** The channel NOT currently in use, when the workflow offers a second one. */
  otherChannel: PhoneOtpChannel | null;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <ContactCodeEntry
        code={code}
        onChange={onChange}
        codeLength={codeLength}
        style={style}
        disabled={disabled}
        onComplete={onComplete}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {expiresAt ? <ExpiryCountdown expiresAt={expiresAt} /> : <span>The code expires in 5 minutes.</span>}
        <button
          type="button"
          className="font-medium text-primary hover:underline disabled:opacity-50"
          onClick={() => onResend()}
          disabled={disabled}
        >
          Resend code
        </button>
      </div>
      {/* The single most useful escape hatch on this screen: a code that never
          arrives is usually a channel problem, not a typo. */}
      {otherChannel && (
        <button
          type="button"
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          onClick={() => onResend(otherChannel)}
          disabled={disabled}
        >
          Didn&rsquo;t get it? Send by {channelLabel(otherChannel)} instead
        </button>
      )}
    </div>
  );
}
