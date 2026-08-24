import { describe, it, expect } from 'vitest';
import pkg from '../../package.json';
// Read by PATH rather than by package name: `exports` hides ./package.json from
// a normal specifier, and these are the two manifests the invariant is about.
import dialogPkg from '../../node_modules/@radix-ui/react-dialog/package.json';
import focusScopePkg from '../../node_modules/@radix-ui/react-focus-scope/package.json';

// DropdownSurface works by mounting a second Radix focus scope, which pauses the
// dialog's. That only happens if both scopes push onto the SAME
// `focusScopesStack` — a module-level array. Two copies of the package mean two
// stacks, the dialog's scope is never paused, and every dropdown's search box
// silently stops accepting focus again. Nothing about that failure is visible in
// the code, which is why it is asserted here.
//
// Radix pins its internal dependencies to EXACT versions, so matching the pin is
// what guarantees one copy. When @radix-ui/react-dialog is upgraded, this test
// fails and the pin in package.json moves with it.
describe('focus-scope version pin', () => {
  const pinned = (dialogPkg.dependencies as Record<string, string>)[
    '@radix-ui/react-focus-scope'
  ];

  it('matches the version @radix-ui/react-dialog pins', () => {
    const ours = (pkg.dependencies as Record<string, string>)['@radix-ui/react-focus-scope'];
    expect(ours).toBe(pinned);
  });

  it('installs the copy the dialog is pinned to, not a second one', () => {
    expect(focusScopePkg.version).toBe(pinned);
  });
});
