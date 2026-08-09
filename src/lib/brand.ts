/**
 * Vendor brand constants for the SDK's own attribution — NOT the integrating
 * org's branding (that is `useBranding()`, driven by `/api/kyc/config`).
 *
 * The platform is **Myaza Trust**, a product of **Myaza** (the parent company).
 * Always the full product name here: bare "Myaza" is the company, and a pipe
 * ("Myaza | Trust") reads as a separator between two items rather than one
 * name — fragmenting the brand at the exact moment we are trying to establish
 * it. See the naming rule in kyc-dashboard/CLAUDE.md.
 */
export const PRODUCT_NAME = 'Myaza Trust';

/** The product site — where "who are these people?" gets answered. */
export const PRODUCT_URL = 'https://trust.myaza.co';

/**
 * The Myaza brand face, hardcoded — NOT `var(--font-heading)`.
 *
 * "TRUST" is half of the wordmark lockup, not UI copy, so it must survive an
 * org's typography settings. Reading a token would defeat that: `--font-heading`
 * and `--font-sans` are exactly what `appearance.headingFontFamily` /
 * `fontFamily` overwrite, so an org choosing Poppins would silently restyle our
 * mark into their own brand.
 *
 * KARLA, matching the dashboard sidebar's lockup. Worth stating because the
 * obvious guess is wrong: the sidebar's "Trust" span sets no font-family, so it
 * inherits the dashboard BODY face (`--font-sans: var(--font-karla)`) — not the
 * Space Grotesk heading face the wordmark sits beside.
 *
 * Named, not loaded — matching how the SDK treats its own defaults everywhere
 * else — so it falls back to `system-ui` on a page that lacks it rather than
 * costing a webfont fetch for one word.
 */
export const BRAND_FONT_STACK = '"Karla", system-ui, sans-serif';

/**
 * End-user legal documents linked from the consent screen.
 *
 * These are MYAZA's terms, not the integrating org's — the person is consenting
 * to us processing their data as the verification provider, so the links must
 * not be org-overridable.
 */
export const TERMS_URL = 'https://trust.myaza.co/legal/terms';
export const PRIVACY_URL = 'https://trust.myaza.co/legal/privacy';

/**
 * Version of the consent wording shown on the Continue screen.
 *
 * Consent is now given by ACTING (tapping Continue) rather than ticking a box,
 * so nothing on the record says what the user actually agreed to. Bump this
 * whenever the consent copy changes materially, and store it with the
 * verification — without it you cannot later prove which disclosure was on
 * screen when someone consented, which is the whole evidentiary value.
 */
export const CONSENT_VERSION = '2026-08-06.1';

/**
 * Tones the footer mark may use — the design system's INK and LIGHT text
 * colours, not the brand purple.
 *
 * Attribution, not advertising. A saturated purple mark is the loudest thing in
 * the footer on an org whose palette is yellow or green: it draws the eye to the
 * least important element on screen and reads as a clash rather than a
 * signature. Every comparable vendor mark (Stripe, Plaid, Persona) is monochrome
 * for the same reason.
 *
 * Nothing is lost by it — the logo ICON keeps its fixed brand fills, so the
 * Myaza identity is still carried by the mark itself while the text recedes.
 * These two are the design system's own text tones, so this stays on-brand
 * rather than arbitrary black-on-white.
 */
const MARK_TONES = ['#070330', '#F6F5FE'] as const;

/** WCAG AA for the small text this renders at. */
const MIN_MARK_CONTRAST = 4.5;

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const channel = (i: number): number => {
    const s = parseInt(h.slice(i, i + 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Pick the mark tone that stays legible on `background`.
 *
 * The footer mark must NOT follow the org's palette — repainted in a customer's
 * colour it stops reading as ours, and against a background of the same hue it
 * disappears. Chosen by CONTRAST rather than by light/dark theme, because an org
 * can set `backgroundColor` to any value, including mid-tones where neither
 * variant is obviously right.
 *
 * Falls back to the highest-contrast tone when none clears AA, so the mark is
 * always the most visible option available rather than a fixed guess.
 */
export function brandMarkColor(background: string): string {
  const bg = /^#[0-9a-f]{6}$/i.test(background.trim()) ? background.trim() : '#ffffff';
  for (const tone of MARK_TONES) {
    if (contrastRatio(tone, bg) >= MIN_MARK_CONTRAST) return tone;
  }
  return MARK_TONES.reduce((best, tone) =>
    contrastRatio(tone, bg) > contrastRatio(best, bg) ? tone : best,
  );
}
