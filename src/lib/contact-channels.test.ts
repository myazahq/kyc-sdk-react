import { describe, it, expect } from 'vitest';
import { channelLabel, offeredPhoneChannels } from './contact-channels';

// Which channels a phone OTP step offers, and which one is selected by default.
// Worth testing on its own: every failure here is silent. A wrong default sends
// every code down a channel the org did not choose, and the user just sees a
// code that never arrives.

describe('offeredPhoneChannels', () => {
  it('falls back to SMS when the workflow says nothing', () => {
    // Matches the server, which defaults `via` to sms when it is omitted.
    expect(offeredPhoneChannels(undefined)).toEqual(['sms']);
    expect(offeredPhoneChannels(null)).toEqual(['sms']);
    expect(offeredPhoneChannels([])).toEqual(['sms']);
  });

  it('keeps the workflow order, so its first entry is the default', () => {
    expect(offeredPhoneChannels(['whatsapp', 'sms'])).toEqual(['whatsapp', 'sms']);
    expect(offeredPhoneChannels(['sms', 'whatsapp'])).toEqual(['sms', 'whatsapp']);
  });

  it('drops channels this build cannot render', () => {
    // A channel added server-side must not surface as an unlabelled button in
    // an SDK that shipped before it existed.
    expect(offeredPhoneChannels(['sms', 'telegram'])).toEqual(['sms']);
    expect(offeredPhoneChannels(['telegram'])).toEqual(['sms']);
  });

  it('collapses duplicates', () => {
    expect(offeredPhoneChannels(['sms', 'sms', 'whatsapp'])).toEqual(['sms', 'whatsapp']);
  });

  it('never returns an empty list', () => {
    // The step reads [0] for its initial channel; an empty list would send
    // `via: undefined` and quietly hand the choice back to the server.
    for (const input of [undefined, [], ['nope'], ['', ' ']]) {
      expect(offeredPhoneChannels(input as string[] | undefined).length).toBeGreaterThan(0);
    }
  });
});

describe('channelLabel', () => {
  it('names the channels the way the copy does', () => {
    expect(channelLabel('sms')).toBe('SMS');
    expect(channelLabel('whatsapp')).toBe('WhatsApp');
  });
});
