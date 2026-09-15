import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { IN_MONOREPO } from '../../__tests__/monorepo';
// Read by PATH: `exports` hides ./package.json from a normal specifier.
import dialogPkg from '../../../node_modules/@radix-ui/react-dialog/package.json';

// Radix ≤1.1.15 shipped a dev-time accessibility check that did
// `document.getElementById(titleId)` and console.error'd when it found nothing.
//
// The SDK portals every dialog into a SHADOW ROOT (lib/sdk-frame.tsx — that is
// what keeps the host app's CSS out and ours in), and `document.getElementById`
// cannot pierce a shadow root. So the check failed on every open no matter what
// we rendered: `DialogTitle` was there the whole time, correctly labelling the
// content within its own tree, and every integrator still got
//
//   `DialogContent` requires a `DialogTitle` for the component to be accessible
//
// in their console — not gated on NODE_ENV, so in production too. Chasing it by
// adding titles is a dead end; they were never missing.
//
// Radix removed both warnings in 1.1.16+.
//
// One thing this does NOT do is fix it for integrators. tsup leaves
// `dependencies` external, so `@radix-ui/react-dialog` is a runtime import that
// the CONSUMER app resolves — the dashboard hit exactly this and needed the
// same floor in its own package.json. What the floor here buys is our own dev
// server, the example app, and a fresh install that has nothing else pinning it
// lower. Asserted rather than commented, because the failure is silent console
// noise rather than a broken build.
const MIN_VERSION = [1, 1, 23] as const;

// The override lives in the MONOREPO root's package.json. The public mirror
// carries this package alone, so that file is not there: a static import of it
// failed the whole suite at collection. Read it only in the monorepo, and skip
// the assertion that needs it elsewhere (see __tests__/monorepo.ts).
const rootPkg: { pnpm?: { overrides?: Record<string, string> } } | null = IN_MONOREPO
  ? JSON.parse(readFileSync(new URL('../../../../../package.json', import.meta.url).pathname, 'utf8'))
  : null;

function parse(v: string): number[] {
  return v.split('-')[0]!.split('.').map(Number);
}

function atLeast(actual: string, min: readonly number[]): boolean {
  const a = parse(actual);
  for (let i = 0; i < min.length; i++) {
    if ((a[i] ?? 0) !== min[i]) return (a[i] ?? 0) > min[i]!;
  }
  return true;
}

describe('radix dialog: no document-scoped a11y warning', () => {
  it('installs a version with the warnings removed', () => {
    expect(atLeast(dialogPkg.version, MIN_VERSION)).toBe(true);
  });

  it.skipIf(!IN_MONOREPO)('forces vaul onto the same copy, so the drawer cannot reintroduce it', () => {
    // vaul (the Drawer) declares its own `^1.1.1` and resolved to 1.1.15 —
    // a SECOND copy, warning away behind every sheet, invisible from our own
    // dependency list. The root override is what collapses them into one.
    const override = rootPkg?.pnpm?.overrides?.['@radix-ui/react-dialog'];
    expect(override).toBeDefined();
    expect(atLeast(override!.replace(/^[^\d]*/, ''), MIN_VERSION)).toBe(true);
  });
});
