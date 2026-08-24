/**
 * Injects the SDK's compiled stylesheet into a shadow root.
 *
 * The sheet is the SAME Tailwind build shipped as dist/styles.css, bundled
 * into the JS as a string (src/generated/styles.css, built before tsup — see
 * package.json). Inside a shadow root it styles only the SDK; outside, the
 * host app's stylesheets structurally cannot match SDK elements. One
 * CSSStyleSheet instance is shared by every shadow root the SDK creates, so a
 * second root (or a second SDK instance) costs no extra parsed CSS.
 */

import sdkCss from '../generated/styles.css.txt';

/**
 * The isolation barrier itself. `all: initial` stops the host page's
 * INHERITED properties (font, color, pointer-events — Radix sets
 * `pointer-events: none` on body while a modal is open) at the shadow host;
 * `all` deliberately excludes custom properties, so the sheet's `:root, :host`
 * tokens still apply. `display: contents` keeps the host box out of the host
 * app's layout — the trigger button lays out exactly where the bare button
 * used to.
 */
const HOST_RESET = ':host{all:initial;display:contents}';

let sharedSheet: CSSStyleSheet | null | undefined;

/**
 * Vaul (the Drawer) injects its base CSS — the slide/fade transitions keyed on
 * `[data-vaul-*]` attributes — into document.head at import time, where a
 * shadow tree cannot see it. Fold those rules into the shadow sheet, matched
 * by content. Runs once (cached with the sheet); vaul's module-scope
 * `__insertCSS` has always executed by the time a React effect builds this.
 */
const headLibraryCss = (): string =>
  [...document.head.querySelectorAll('style')]
    .map((s) => s.textContent ?? '')
    .filter((t) => t.includes('data-vaul-'))
    .join('\n');

const fullCss = (): string => `${HOST_RESET}\n${sdkCss}\n${headLibraryCss()}`;

export function applySdkStyles(root: ShadowRoot): void {
  ensureGlobalPropertyRules();
  if (sharedSheet === undefined) {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(fullCss());
      sharedSheet = sheet;
    } catch {
      // Constructable stylesheets are missing (Safari < 16.4) — fall back to a
      // per-root <style> element below.
      sharedSheet = null;
    }
  }
  if (sharedSheet) {
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sharedSheet];
    return;
  }
  const style = document.createElement('style');
  style.setAttribute('data-myaza-kyc-styles', '');
  style.textContent = fullCss();
  root.appendChild(style);
}

const PROPERTY_STYLE_ID = 'myaza-kyc-property-rules';

/**
 * Hoist the sheet's `@property` rules to the document once.
 *
 * Tailwind v4 registers its `--tw-*` variables (initial values for transform,
 * shadow, gradient compositions) via `@property`, and `@property` registration
 * is document-scoped — a rule inside a shadow root's stylesheet is ignored, so
 * without this, transforms and shadows silently break in modern browsers. (The
 * sheet's `@layer properties` fallback only fires in browsers WITHOUT
 * `@property` support.) The rules are flat, `--tw-`-namespaced and
 * `inherits: false`, so registering them document-wide is harmless — a host
 * app on Tailwind v4 registers the identical set anyway.
 */
export function ensureGlobalPropertyRules(): void {
  if (typeof document === 'undefined' || document.getElementById(PROPERTY_STYLE_ID)) return;
  const rules = sdkCss.match(/@property\s+--[\w-]+\s*\{[^}]*\}/g);
  if (!rules?.length) return;
  const style = document.createElement('style');
  style.id = PROPERTY_STYLE_ID;
  style.textContent = rules.join('');
  document.head.appendChild(style);
}
