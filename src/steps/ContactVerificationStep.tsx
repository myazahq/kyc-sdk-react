'use client';

import React, { useState } from 'react';
import { CheckCircle2, Loader2, Mail, Smartphone } from 'lucide-react';
import { StepHeader } from '../components/StepHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PhoneNumberInput } from '../components/PhoneNumberInput';
import { ContactCodeEntry } from './ContactCodeEntry';
import { ExpiryCountdown } from '../components/ExpiryCountdown';
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

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await config.api.contactSend({
        channel,
        destination,
        codeLength,
        ...(maxAttempts != null ? { maxAttempts } : {}),
        ...(isEmail ? {} : { via: config.phoneVerification?.channels?.[0] ?? 'sms' }),
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
            ? `Enter the ${codeLength}-digit code we sent to ${destination}.`
            : isEmail
              ? "We'll send a one-time code to confirm this email belongs to you."
              : "We'll send a one-time code by SMS to confirm this number belongs to you."
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
        isEmail ? (
          <div className="space-y-2">
            <Label htmlFor="contact-destination">Email address</Label>
            <Input
              id="contact-destination"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Phone number</Label>
            <PhoneNumberInput
              defaultCountry={config.phoneVerification?.defaultCountry ?? config.country}
              disabled={busy}
              onChange={setPhone}
            />
          </div>
        )
      ) : (
        <div className="space-y-3">
          <ContactCodeEntry
            code={code}
            onChange={setCode}
            codeLength={codeLength}
            style={stepConfig?.inputStyle ?? 'segmented'}
            disabled={busy}
            onComplete={(c) => check(c)}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {expiresAt ? <ExpiryCountdown expiresAt={expiresAt} /> : <span>The code expires in 5 minutes.</span>}
            <button type="button" className="font-medium text-primary hover:underline disabled:opacity-50" onClick={send} disabled={busy}>
              Resend code
            </button>
          </div>
        </div>
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
            onClick={challengeId ? () => check() : send}
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
