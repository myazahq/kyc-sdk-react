import type { CSSProperties } from 'react';
import type { KYCAppearance } from '../types/config';

/**
 * Maps the consumer's `appearance` colors to the SDK's design-token CSS
 * variables. The result is applied as an inline `style` on the modal root (and
 * the trigger button), so overrides are **scoped to the SDK** and never leak
 * into the host page's `:root`. Tailwind opacity utilities (`bg-primary/10`,
 * `border-primary/30`, …) resolve against these variables via `color-mix`, so
 * setting a single token cascades to all of its shades automatically.
 *
 * Tokens left unset fall back to the built-in light/dark values in globals.css.
 */
export function buildThemeVars(appearance?: KYCAppearance): CSSProperties {
  if (!appearance) return {};

  const vars: Record<string, string> = {};
  const set = (token: string, value?: string) => {
    if (value) vars[token] = value;
  };

  // Brand color also drives the focus ring so it matches.
  set('--primary', appearance.primaryColor);
  set('--ring', appearance.primaryColor);
  set('--primary-foreground', appearance.primaryTextColor);

  set('--accent', appearance.accentColor);
  set('--background', appearance.backgroundColor);

  // "Surface" covers both the secondary (cards) and muted (subtle fills) tokens.
  set('--secondary', appearance.surfaceColor);
  set('--muted', appearance.surfaceColor);

  // Borders and input outlines share one knob (they're equal in the defaults).
  set('--border', appearance.borderColor);
  set('--input', appearance.borderColor);

  set('--foreground', appearance.textColor);

  return vars as CSSProperties;
}
