import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ─── Every colour utility must name a token that exists ──────────────────────
//
// `bg-card` shipped in SupportingDocumentCard and emitted NOTHING: `--color-card`
// is a shadcn token this SDK never declared, so Tailwind generated no rule and
// the card rendered transparent on the page while the wells inside it DID take
// the flow's brand. It type-checked, it rendered, and it was silently wrong —
// the failure class this repo pins with source scans, because no input makes a
// missing CSS rule throw.
//
// Deliberately `bg-` only. `text-` and `border-` carry sizes, widths and styles
// as well as colours, so scanning them needs a second list of what is not a
// colour, and a guard that cries wolf gets deleted.

const SRC = new URL('..', import.meta.url).pathname;

/** Tailwind's own palette (`amber-500`) and its keywords are always available. */
const PALETTE = /^[a-z]+-\d{2,3}$/;
const KEYWORDS = new Set(['transparent', 'current', 'inherit', 'white', 'black']);

/** Non-colour `bg-` utilities: `bg-clip-text`, `bg-cover`, `bg-gradient-to-r`. */
const NOT_A_COLOUR =
  /^(clip|origin|blend|gradient|linear|radial|conic|repeat|no|auto|cover|contain|center|top|bottom|left|right|fixed|local|scroll|none|size|position)\b/;

function declaredTokens(): Set<string> {
  const css = readFileSync(join(SRC, 'globals.css'), 'utf8');
  const names = new Set<string>();
  for (const [, name] of css.matchAll(/--color-([a-z0-9-]+)\s*:/g)) names.add(name);
  return names;
}

describe('colour utilities reference declared tokens', () => {
  it('declares every bg-* colour the source uses', () => {
    const declared = declaredTokens();
    // The token list is what the guard is worth; an empty parse would pass
    // everything silently, which is the bug it exists to catch.
    expect(declared.has('background')).toBe(true);
    expect(declared.has('secondary')).toBe(true);

    const sources = readdirSync(SRC, { recursive: true }).filter(
      (rel) => /\.tsx?$/.test(rel) && !rel.includes('node_modules') && !/\.test\.tsx?$/.test(rel),
    );

    const missing = new Map<string, Set<string>>();
    for (const rel of sources) {
      // Strip line comments so prose ABOUT a dead token is not read as a use.
      const code = readFileSync(join(SRC, rel), 'utf8').replace(/^\s*(\/\/|\*|\/\*).*$/gm, '');
      for (const [, token] of code.matchAll(/\bbg-([a-z][a-z0-9-]*)/g)) {
        if (declared.has(token) || KEYWORDS.has(token)) continue;
        if (PALETTE.test(token) || NOT_A_COLOUR.test(token)) continue;
        missing.set(token, (missing.get(token) ?? new Set()).add(rel));
      }
    }

    expect(
      Object.fromEntries([...missing].map(([token, files]) => [`bg-${token}`, [...files]])),
    ).toEqual({});
  });
});
