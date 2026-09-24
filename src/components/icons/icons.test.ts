import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ─── One icon set, one identity ──────────────────────────────────────────────
//
// The SDK draws Hugeicons Stroke Rounded, the same set and the same 1.6 weight
// as the dashboard, through the single boundary in ./app-icon. A stray
// `from 'lucide-react'` would still compile, still render, and still look
// almost right — a second icon language inside one modal, at a different stroke
// weight, which nobody notices in review and everybody notices on screen.
//
// So the guard is on the IMPORT, not the appearance: lucide is no longer a
// dependency, and this is what keeps it from coming back through a copied line.

const SRC = new URL('../..', import.meta.url).pathname;

function sources(): string[] {
  return readdirSync(SRC, { recursive: true })
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
    .map((f) => join(SRC, f));
}

describe('icons come from one set', () => {
  it('scans real source files', () => {
    // An empty scan would pass everything silently, which is the bug the guard
    // exists to catch.
    expect(sources().length).toBeGreaterThan(100);
  });

  it('imports no icon from lucide-react', () => {
    const offenders = sources().filter((f) => /from\s*['"]lucide-react['"]/.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => f.slice(SRC.length))).toEqual([]);
  });

  it('reaches Hugeicons only through the app-icon boundary', () => {
    const boundary = join(SRC, 'components/icons/');
    const offenders = sources().filter(
      (f) => !f.startsWith(boundary) && /from\s*['"]@hugeicons\//.test(readFileSync(f, 'utf8')),
    );
    expect(offenders.map((f) => f.slice(SRC.length))).toEqual([]);
  });
});
