// node:fs / node:path are declared in node-builtins.d.ts — this browser-typed
// package has no @types/node, deliberately.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The defect this pins: KYCConfigProvider is mounted with an EXPLICIT prop
// list, so a workflow key that reaches the merged props but is missing from
// that list silently never exists for any step. It is a quiet failure — types
// pass, tests on the pure helpers pass, and the feature simply does not run.
// It shipped three times before this test: `requiredIdTypes` (multi-ID flows
// never looped), `resubmit` (hosted send-backs walked the full flow), and
// `deviceIntelligence` (a workflow's opt-out never reached fingerprint
// collection). A source scan is crude, but it is the check that would have
// caught all three.

const SRC = join(new URL('..', import.meta.url).pathname);
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

/**
 * The provider-mount JSX block of a file (first KYCConfigProvider opening
 * tag). The tag terminator is the lone `>` on its own line — searching for the
 * first bare `>` cut the block short at a generic inside an attribute cast
 * (`Array<{...}> | undefined`), silently exempting every key after it.
 */
function providerMount(source: string): string {
  const start = source.indexOf('<KYCConfigProvider');
  expect(start).toBeGreaterThan(-1);
  const end = source.slice(start).search(/\n\s*>\s*\n/);
  expect(end).toBeGreaterThan(-1);
  return source.slice(start, start + end);
}

function workflowKeys(): string[] {
  const merge = read('lib/workflow-merge.ts');
  const list = merge.slice(merge.indexOf('const WORKFLOW_KEYS'), merge.indexOf('] as const'));
  return [...list.matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]!);
}

describe('every workflow key survives the MyazaKYC provider mount', () => {
  // Keys that deliberately do NOT ride the config context: they are consumed
  // in MyazaKYC itself (before the provider) or threaded to KYCModal as
  // component props. Adding a key here is a claim that some step will never
  // need it — check every `config.<key>` consumer before you do.
  const PROP_THREADED = new Set(['voiceGuidance', 'showThemeToggle', 'fullScreen', 'disableClose']);

  it('MyazaKYC passes each key (or documents why not)', () => {
    const mount = providerMount(read('MyazaKYC.tsx'));
    const missing = workflowKeys().filter(
      (key) => !PROP_THREADED.has(key) && !mount.includes(`${key}={`),
    );
    expect(missing).toEqual([]);
  });

  it('the prop-threaded exceptions really are threaded to KYCModal', () => {
    const source = read('MyazaKYC.tsx');
    const modal = source.slice(source.indexOf('<KYCModal'), source.indexOf('/>', source.indexOf('<KYCModal')));
    for (const key of ['showThemeToggle', 'fullScreen', 'disableClose']) {
      expect(modal).toContain(`${key}={`);
    }
    // voiceGuidance is consumed in MyazaKYC itself (configureSpeech).
    expect(source).toContain('configureSpeech(voiceGuidance)');
  });

  it('the hosted mount passes the keys that burned us', () => {
    const mount = providerMount(read('hosted/HostedFlow.tsx'));
    for (const key of ['multiId', 'resubmit', 'deviceIntelligence']) {
      expect(mount).toContain(key);
    }
  });
});
