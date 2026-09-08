// node:fs / node:path are declared in node-builtins.d.ts — this browser-typed
// package has no @types/node, deliberately (the CaptureRing.test.ts convention).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ─── The pending line is a skeleton that speaks ─────────────────────────────
//
// The bar is geometry; the label is the message. Both must survive an edit,
// and the shimmer must respect reduced motion like every other skeleton here.

const source = readFileSync(join(new URL('.', import.meta.url).pathname, 'LineSkeleton.tsx'), 'utf8');

describe('LineSkeleton', () => {
  it('announces its label as a polite status', () => {
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('aria-label={label}');
  });

  it('hides the bar from assistive tech and holds still under reduced motion', () => {
    expect(source).toContain('aria-hidden');
    expect(source).toContain('motion-reduce:animate-none');
  });

  it('is never a spinner', () => {
    expect(source).not.toMatch(/Loader2|animate-spin/);
  });
});
