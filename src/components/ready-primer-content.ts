import { IdCard, ScanFace, ScanLine, Sun, Timer, UserRound } from 'lucide-react';
import type { ReadyPrimerProps } from './ReadyPrimer';

/**
 * Copy for the two "here's what happens next" screens, in ONE place.
 *
 * Both the real capture steps and the builder-preview placeholder render these,
 * and the preview's whole job is to show what end users will see — so the two
 * must never drift. Keeping the strings here rather than inline in each step is
 * what makes that guarantee cheap.
 */
export type ReadyContent = Pick<ReadyPrimerProps, 'icon' | 'title' | 'body' | 'checklist'>;

export const READY_DOCUMENT: ReadyContent = {
  icon: ScanLine,
  title: "You're about to scan your ID",
  body: "We'll photograph your document and read it automatically. Nothing is shared until you submit.",
  checklist: [
    { icon: IdCard, label: 'Have your physical document with you' },
    { icon: Sun, label: 'Find even lighting, avoid glare' },
    { icon: Timer, label: 'Takes about a minute' },
  ],
};

export const READY_LIVENESS: ReadyContent = {
  icon: ScanFace,
  title: "Let's confirm you're really here",
  body: "You'll follow a few short prompts on screen. This proves a real person is present, not a photo or a recording.",
  checklist: [
    { icon: UserRound, label: 'Put your face in the circle' },
    { icon: Sun, label: 'Find even lighting, remove sunglasses' },
    { icon: Timer, label: 'Takes about 10 seconds' },
  ],
};
