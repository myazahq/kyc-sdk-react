// Phone OTP delivery channels.
//
// The workflow says which channels are ON OFFER; when it offers more than one,
// the person receiving the code picks between them — only they know whether
// they have WhatsApp installed or whether SMS is reaching them today.
//
// Pure so it can be tested without mounting the step: getting the default wrong
// silently sends every code down a channel the org did not choose.

export type PhoneOtpChannel = 'sms' | 'whatsapp';

const KNOWN: PhoneOtpChannel[] = ['sms', 'whatsapp'];

const LABELS: Record<PhoneOtpChannel, string> = {
  sms: 'SMS',
  whatsapp: 'WhatsApp',
};

/** Display name for a channel, for step copy and the picker. */
export function channelLabel(channel: PhoneOtpChannel): string {
  return LABELS[channel] ?? channel;
}

/**
 * The channels to offer for a phone step, normalised.
 *
 * Never empty: an unset, empty or entirely-unrecognised list falls back to SMS,
 * which is what the server defaults to when `via` is omitted. Unknown values
 * are dropped rather than rendered, so a future channel added server-side
 * cannot surface as an unlabelled button in an old SDK build. Duplicates
 * collapse; the workflow's order is preserved, so its first entry is the
 * default the user sees selected.
 */
export function offeredPhoneChannels(channels?: string[] | null): PhoneOtpChannel[] {
  const known = (channels ?? []).filter((c): c is PhoneOtpChannel =>
    KNOWN.includes(c as PhoneOtpChannel),
  );
  const deduped = Array.from(new Set(known));
  return deduped.length > 0 ? deduped : ['sms'];
}
