// ---------------------------------------------------------------------------
// Challenge Manager — randomly picks 2-3 challenges, tracks progress
// ---------------------------------------------------------------------------

import {
  CHALLENGE_POOL,
  type ChallengeConfig,
  type LivenessChallenge,
  type LivenessConfig,
  DEFAULT_LIVENESS_CONFIG,
} from './types';

// ---------------------------------------------------------------------------
// Similarity groups — gestures within a group should not appear together
// because one can accidentally trigger the other.
// ---------------------------------------------------------------------------

const SIMILARITY_GROUPS: LivenessChallenge[][] = [
  ['nod', 'turn'],  // head movement can overlap
];

function areSimilar(a: LivenessChallenge, b: LivenessChallenge): boolean {
  return SIMILARITY_GROUPS.some(
    (group) => group.includes(a) && group.includes(b),
  );
}

// ---------------------------------------------------------------------------
// Pick random challenges — ensures no two similar gestures are selected
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickChallenges(config: Partial<LivenessConfig> = {}): ChallengeConfig[] {
  const merged = { ...DEFAULT_LIVENESS_CONFIG, ...config };

  // Filter pool if a subset is specified
  let pool = CHALLENGE_POOL;
  if (merged.challengePool && merged.challengePool.length > 0) {
    const allowed = new Set<LivenessChallenge>(merged.challengePool);
    pool = CHALLENGE_POOL.filter((c) => allowed.has(c.type));
  }

  const count = Math.min(merged.challengeCount, pool.length);
  const shuffled = shuffle(pool);

  // Greedily pick challenges that aren't similar to already-picked ones
  const picked: ChallengeConfig[] = [];
  for (const candidate of shuffled) {
    if (picked.length >= count) break;
    const hasSimilar = picked.some((p) => areSimilar(p.type, candidate.type));
    if (!hasSimilar) {
      picked.push({ ...candidate, timeoutSeconds: merged.timeoutPerChallenge });
    }
  }

  // Fallback: if similarity rules were too strict, fill remaining slots
  if (picked.length < count) {
    for (const candidate of shuffled) {
      if (picked.length >= count) break;
      if (!picked.some((p) => p.type === candidate.type)) {
        picked.push({ ...candidate, timeoutSeconds: merged.timeoutPerChallenge });
      }
    }
  }

  return picked;
}

// ---------------------------------------------------------------------------
// Progress tracker
// ---------------------------------------------------------------------------

export type ChallengeProgress = 'pending' | 'active' | 'passed' | 'failed';

export interface ChallengeEntry {
  config: ChallengeConfig;
  progress: ChallengeProgress;
}

export class ChallengeTracker {
  private entries: ChallengeEntry[];
  private _currentIndex: number;

  constructor(challenges: ChallengeConfig[]) {
    this.entries = challenges.map((config, i) => ({
      config,
      progress: i === 0 ? 'active' : 'pending',
    }));
    this._currentIndex = 0;
  }

  get current(): ChallengeEntry | null {
    return this.entries[this._currentIndex] ?? null;
  }

  get currentIndex(): number {
    return this._currentIndex;
  }

  get all(): readonly ChallengeEntry[] {
    return this.entries;
  }

  get isComplete(): boolean {
    return this.entries.every((e) => e.progress === 'passed');
  }

  get totalCount(): number {
    return this.entries.length;
  }

  markCurrentPassed(): void {
    if (this._currentIndex < this.entries.length) {
      this.entries[this._currentIndex].progress = 'passed';
    }
  }

  markCurrentFailed(): void {
    if (this._currentIndex < this.entries.length) {
      this.entries[this._currentIndex].progress = 'failed';
    }
  }

  advance(): boolean {
    this._currentIndex++;
    if (this._currentIndex < this.entries.length) {
      this.entries[this._currentIndex].progress = 'active';
      return true; // More challenges
    }
    return false; // All done
  }
}
