'use client';

import React, { useState } from 'react';
import { CheckCircle2, Loader2, Mail, Smartphone } from 'lucide-react';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/ui/button';
import { ContactChannelPicker } from '../components/ContactChannelPicker';
import {
  channelLabel,
  offeredPhoneChannels,
  type PhoneOtpChannel,
} from '../lib/contact-channels';
import { ContactDestinationField } from './ContactDestinationField';
import { ContactCodePanel } from './ContactCodePanel';
import { useKYCContext } from '../context/KYCContext';
import { useKYCConfig } from '../context/KYCConfigContext';
import { stepAfterContact } from '../lib/contact-steps';
import { isBusinessFlow } from '../lib/business';
import { describeSendError, describeCheckError } from '../lib/contact-errors';

// Contact-verification OTP step (email or phone — one component, two mounts).
// enter → send → code entry → verified → continue. The proof token is stored
// in the reducer and submitted with /verify (contact.emailToken/phoneToken).

const DEFAULT_CODE_LENGTH = 6;

export function ContactVerificationStep({ channel }: { channel: 'email' | 'phone' }) {
  const { state, dispatch } = useKYCContext();
  const config = useKYCConfig();
  const isEmail = channel === 'email';
  const stepConfig = isEmail ? config.emailVerification : config.phoneVerification;
  const required = stepConfig?.required !== false;
  const codeLength = Math.min(8, Math.max(4, stepConfig?.codeLength ?? DEFAULT_CODE_LENGTH));
  const maxAttempts = stepConfig?.maxAttempts;
  const alreadyVerified = isEmail ? state.contact.emailToken != null : state.contact.phoneToken != null;

  // Email: the typed address is the destination. Phone: the PhoneNumberInput
  // emits the E.164 value + validity; we send that.
  const [email, setEmail] = useState((isEmail ? state.contact.emailAddress : '') ?? '');
  const [phone, setPhone] = useState<{ e164: string; isValid: boolean }>({
    e164: state.contact.phoneNumber ?? '',
    isValid: false,
  });
  const destination = isEmail ? email.trim() : phone.e164;
  // In the builder preview, Send is always enabled so the org can reach (and
  // preview) the code-entry screen — with its two input styles + the configured
  // number of slots — in one click, without typing a real destination.
  const canSend = config.previewMode || (isEmail ? /.+@.+\..+/.test(destination) : phone.isValid);

  // Delivery channel. The org chooses what's ON OFFER; the person receiving the
  // code chooses between them — only they know whether they have WhatsApp, or
  // whether SMS is landing for them today. One offered channel = no choice to
  // make, and the picker renders nothing.
  const offeredChannels: PhoneOtpChannel[] = isEmail
    ? []
    : offeredPhoneChannels(config.phoneVerification?.channels);
  const [via, setVia] = useState<PhoneOtpChannel>(offeredChannels[0] ?? 'sms');
  const otherChannel = offeredChannels.find((c) => c !== via) ?? null;

  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const advance = () =>
    dispatch({
      type: 'SET_STEP',
      payload: stepAfterContact(
        { ...config, subjectTypeIsBusiness: isBusinessFlow(config) },
        isEmail ? 'email-verification' : 'phone-verification',
      ),
    });

  /** `switchTo` re-sends over the other channel when the first one didn't land. */
  const send = async (switchTo?: PhoneOtpChannel) => {
    const sendVia = switchTo ?? via;
    if (switchTo) setVia(switchTo);
    setBusy(true);
    setError(null);
    try {
      const res = await config.api.contactSend({
        channel,
        destination,
        codeLength,
        ...(maxAttempts != null ? { maxAttempts } : {}),
        ...(isEmail ? {} : { via: sendVia }),
      });
      setChallengeId(res.challengeId);
      setExpiresAt(res.expiresAt ?? null);
      setCode('');
    } catch (err) {
      setError(describeSendError(err));
    } finally {
      setBusy(false);
    }
  };

  const check = async (submitted?: string) => {
    const value = (submitted ?? code).trim();
    if (!challengeId || value.length < 4) return;
    setBusy(true);
    setError(null);
    try {
      const res = await config.api.contactCheck({ challengeId, code: value });
      dispatch({ type: 'SET_CONTACT_PROOF', payload: { channel, token: res.token, destination } });
      advance();
    } catch (err) {
      setError(describeCheckError(err));
    } finally {
      setBusy(false);
    }
  };

  const Icon = isEmail ? Mail : Smartphone;

  return (
    <div className="space-y-6 animate-slide-up">
      <StepHeader
        title={isEmail ? 'Verify your email' : 'Verify your phone number'}
        description={
          challengeId
            ? `Enter the ${codeLength}-digit code we sent to ${destination}${isEmail ? '' : ` by ${channelLabel(via)}`}.`
            : isEmail
              ? "We'll send a one-time code to confirm this email belongs to you."
              : `We'll send a one-time code by ${channelLabel(via)} to confirm this number belongs to you.`
        }
      />

      {alreadyVerified ? (
        <div className="flex items-center gap-3 rounded-xl bg-primary/5 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm font-medium">
            {isEmail ? state.contact.emailAddress : state.contact.phoneNumber} is verified.
          </p>
        </div>
      ) : !challengeId ? (
        <div className="space-y-4">
          <ContactDestinationField
            isEmail={isEmail}
            email={email}
            onEmailChange={setEmail}
            onPhoneChange={setPhone}
            defaultCountry={config.phoneVerification?.defaultCountry ?? config.country}
            disabled={busy}
          />
          <ContactChannelPicker offered={offeredChannels} picked={via} onPick={setVia} disabled={busy} />
        </div>
      ) : (
        <ContactCodePanel
          code={code}
          onChange={setCode}
          onComplete={(c) => check(c)}
          codeLength={codeLength}
          style={stepConfig?.inputStyle ?? 'segmented'}
          expiresAt={expiresAt}
          onResend={send}
          otherChannel={otherChannel}
          disabled={busy}
        />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-3">
        {alreadyVerified ? (
          <Button className="w-full" onClick={advance}>
            Continue
          </Button>
        ) : (
          <Button
            className="w-full"
            onClick={() => (challengeId ? check() : send())}
            disabled={busy || (challengeId ? code.trim().length < 4 : !canSend)}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {challengeId ? 'Verify code' : 'Send code'}
          </Button>
        )}
        {!required && !alreadyVerified && (
          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            onClick={advance}
          >
            Skip for now
          </button>
        )}
      </div>

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {isEmail ? 'We only use this to verify your identity.' : 'Standard message rates may apply.'}
      </p>
    </div>
  );
}
