import type { TextEntry } from '../types';

/** The address flow's "how it works" screen and its three disclosures. */
export const ADDRESS_INTRO_ENTRIES: TextEntry[] = [
  { key: 'address.intro.badge', label: 'Intro: badge', default: 'Address verification' },
  { key: 'address.intro.title', label: 'Intro: title', default: "Let's confirm your address" },
  {
    key: 'address.intro.description',
    label: 'Intro: description',
    default: 'This address will be verified over the coming days. Your part takes a minute; the rest happens on its own.',
    multiline: true,
  },
  { key: 'address.intro.step1.stage', label: 'Intro: step 1 stage', default: 'Your part' },
  { key: 'address.intro.step1.title', label: 'Intro: step 1 title', default: 'Pin your address' },
  {
    key: 'address.intro.step1.caption',
    label: 'Intro: step 1 caption',
    default: 'Put the pin right on your building. Takes a minute.',
  },
  { key: 'address.intro.step2.stage', label: 'Intro: step 2 stage', default: 'After that' },
  { key: 'address.intro.step2.title', label: 'Intro: step 2 title', default: 'Quiet check-ins' },
  {
    key: 'address.intro.step2.caption',
    label: 'Intro: step 2 caption',
    default: 'Keep location on; your phone confirms it over the coming days.',
    multiline: true,
  },
  {
    key: 'address.intro.step2.caption.background',
    label: 'Intro: step 2 caption (background checks)',
    default:
      'Allow location all the time when asked. Your phone then confirms it on its own, even with the app closed.',
    multiline: true,
  },
  { key: 'address.intro.step3.stage', label: 'Intro: step 3 stage', default: 'Then' },
  { key: 'address.intro.step3.title', label: 'Intro: step 3 title', default: 'Confirmed' },
  { key: 'address.intro.step3.caption', label: 'Intro: step 3 caption', default: "You'll be notified. That is it." },
  { key: 'address.intro.howItWorks.title', label: 'Disclosure: how it works title', default: 'How it works' },
  {
    key: 'address.intro.howItWorks.body',
    label: 'Disclosure: how it works',
    default:
      'After you finish, your device periodically confirms it is at this address over the coming days. Only day-level summaries ever leave your phone, never your movements.',
    multiline: true,
  },
  {
    key: 'address.intro.howItWorks.body.background',
    label: 'Disclosure: how it works (background checks)',
    default:
      'After you finish, your phone confirms it is at this address over the coming days, even when the app is closed. Only day-level summaries ever leave your phone, never your movements.',
    multiline: true,
  },
  { key: 'address.intro.control.title', label: 'Disclosure: control title', default: 'You stay in control' },
  {
    key: 'address.intro.control.body',
    label: 'Disclosure: control',
    default:
      'You can turn location off at any time in your device settings. An unfinished check simply expires. It never counts against you.',
    multiline: true,
  },
  { key: 'address.intro.privacy.title', label: 'Disclosure: data title', default: 'Your data is protected' },
  {
    key: 'address.intro.privacy.body',
    label: 'Disclosure: data',
    default:
      "Location summaries are used only to confirm this address and are handled under your country's data protection rules.",
    multiline: true,
  },
  { key: 'address.intro.start', label: 'Intro: start button', default: 'Continue' },
];
