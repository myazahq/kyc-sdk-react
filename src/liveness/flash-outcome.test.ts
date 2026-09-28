import { describe, expect, it } from 'vitest';
import { flashOutcome } from './flash-outcome';
import { ChallengeTracker, pickChallenges, pickFallbackGestures } from './challenge-manager';

const matched = { passed: true, inconclusive: false };
const mismatched = { passed: false, inconclusive: false };
const unmeasurable = { passed: false, inconclusive: true };

describe('flashOutcome', () => {
  it('passes a measured match and fails a measured mismatch', () => {
    expect(flashOutcome(matched, 'flash', 0)).toBe('pass');
    expect(flashOutcome(mismatched, 'flash', 0)).toBe('fail');
    expect(flashOutcome(mismatched, 'both', 1)).toBe('fail');
  });

  it('never passes an unmeasurable flash: one retry first', () => {
    expect(flashOutcome(unmeasurable, 'flash', 0)).toBe('retry');
    expect(flashOutcome(unmeasurable, 'both', 0)).toBe('retry');
  });

  it('after the retry, gestures carry it: already run in both mode, added in flash mode', () => {
    expect(flashOutcome(unmeasurable, 'both', 1)).toBe('accept_gestures');
    expect(flashOutcome(unmeasurable, 'flash', 1)).toBe('fallback_gestures');
  });
});

describe('gesture fallback', () => {
  it('picks gestures only, never another flash', () => {
    const picked = pickFallbackGestures({ mode: 'flash' });
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.every((c) => c.type !== 'flash')).toBe(true);
  });

  it('appends them after the flash so the run continues into them', () => {
    const tracker = new ChallengeTracker(pickChallenges({ mode: 'flash' }));
    tracker.append(pickFallbackGestures({ mode: 'flash' }));
    tracker.markCurrentPassed();
    expect(tracker.advance()).toBe(true);
    expect(tracker.current?.config.type).not.toBe('flash');
  });
});
