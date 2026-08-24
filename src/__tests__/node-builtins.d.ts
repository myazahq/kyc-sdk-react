// This package is browser-typed (no @types/node, deliberately — it ships to
// browsers). The source-scan wiring test is the one place node builtins are
// needed, so the two it uses are declared here, minimally, instead of adding
// node globals to the whole package.
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
}
