import { BRAND_FONT_STACK, PRODUCT_URL, brandMarkColor } from '../lib/brand';
import { useOptionalKYCConfig } from '../context/KYCConfigContext';
import { MyazaWordmark } from './MyazaWordmark';
import { useIsDark } from '../lib/use-is-dark';

/**
 * Vendor attribution, pinned to the bottom of the modal on every step.
 *
 * "POWERED BY", deliberately, not "Secured by". At the moment this is on screen
 * the user is handing over a passport and a live selfie to a company they have
 * never heard of, on behalf of one they have. What they need is PROVENANCE —
 * a name to hold responsible — not a promise. "Secured by" is an unfalsifiable
 * claim made at the exact moment we are collecting rather than protecting, it
 * is the sort of reassurance a phishing overlay writes, and it is a security
 * assertion a regulator can hold us to. Attribution is the more credible move
 * precisely because it claims nothing (Stripe, Plaid and Persona all landed
 * here for the same reason).
 *
 * The lockup mirrors the dashboard's canonical treatment: [Myaza wordmark] then
 * a hairline rule then TRUST in tracked uppercase. The divider is a BORDER, not
 * a "|" character — a typed pipe sits on the text baseline, renders at whatever
 * weight the font gives it, and reads as a list separator between two names.
 * The rule is what makes it one brand: Myaza Trust.
 *
 * The link is the part that carries real weight: a user asked for their ID by an
 * unfamiliar third party should be one tap from finding out who we are — that is
 * verifiable trust rather than asserted trust. In a locked in-app webview
 * `target=_blank` may do nothing, and the mark still stands on its own.
 *
 * Shown on the camera steps too. A trust mark that vanishes on the screens where
 * biometrics are captured would disappear exactly where it matters most.
 */
export function PoweredBy() {
  // Optional on purpose: the biometric re-auth modal renders this footer with
  // no KYCConfigProvider above it, and attribution must not require one.
  const config = useOptionalKYCConfig();
  const isDark = useIsDark();

  // The background the mark will ACTUALLY sit on — which is not simply
  // `appearance.backgroundColor`. Two things that got this wrong:
  //
  //  1. the dark palette lives in `appearance.dark`, so on a dark flow the base
  //     value is the LIGHT background; resolving against it picked the ink tone
  //     and the mark disappeared into the dark surface;
  //  2. `appearance.theme` is only the INITIAL theme — the user can toggle — so
  //     the live class is the authority, not the config.
  //
  // Not read from CSS because contrast cannot be computed in a stylesheet, and
  // this has to hold for an arbitrary org background, not just light vs dark.
  const appearance = config?.appearance;
  const background = isDark
    ? (appearance?.dark?.backgroundColor ?? appearance?.backgroundColor ?? '#040218')
    : (appearance?.backgroundColor ?? '#FFFFFF');
  // ONE colour for the whole mark — label, wordmark lettering and TRUST. Split
  // colours made it read as two things sitting next to each other rather than
  // one lockup.
  const markColor = brandMarkColor(background);

  // Compact on a phone: the footer sat 28px below the lockup on a surface
  // where every row costs the map or the button above it. The bottom keeps
  // clear of the home indicator through the safe-area inset, which is zero in
  // a browser tab (Safari already stops above its own bar) and real in a
  // standalone or in-app WebView, so neither case pads twice.
  return (
    <div className="shrink-0 px-6 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:pt-4 sm:pb-6">
      {/* The ROW is not the link — only the mark is. As a block-level flex child
          the anchor used to span the footer's full width, so the empty space
          either side of the lockup opened myaza.co too. A link's hit area should
          be the thing it points at, and "Powered by" is a label, not a
          destination. */}
      <div className="flex items-center justify-center gap-2.5">
        {/* Small and muted on purpose. "Powered by" is the connective tissue,
            not the message — the BRAND is what should carry the weight, so the
            label stays quiet and the lockup beside it is what the eye lands on.
            Matching their sizes made the sentence loud and the mark ordinary. */}
        <span className="text-xs leading-none opacity-90" style={{ color: markColor }}>
          Powered by
        </span>

        {/* The lockup, spaced TIGHTER than the gap that precedes it so it reads
            as one mark rather than three evenly-spaced items. This is the link:
            wordmark, rule and TRUST are one brand, so the whole lockup is the
            target — but nothing beyond it is. */}
        <a
          href={PRODUCT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-sm opacity-90 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2"
          aria-label="Myaza Trust"
        >
          {/* The icon keeps its brand colours; only the wordmark flips, and it
              does so by inheriting this text colour — one render, both themes. */}
          <span className="flex items-center" style={{ color: markColor }}>
            <MyazaWordmark height={24} />
          </span>

          {/* The rule is part of the mark too, so it follows the same colour
            rather than the org's border token. */}
        <span
          aria-hidden
          className="h-5 w-px shrink-0"
          style={{ backgroundColor: markColor, opacity: 0.35 }}
        />

          {/* ~half the wordmark's height, which is the ratio the dashboard's own
              lockup uses (12px TRUST against a 24px logo). Set it level with the
              logo and TRUST stops reading as a suffix and starts competing. */}
          {/* Pinned to the brand face rather than inheriting: this word is part
              of the MARK, and the font tokens it would otherwise read are the
              ones an org's typography settings overwrite. */}
          <span
            style={{ fontFamily: BRAND_FONT_STACK, color: markColor }}
            className="text-xs font-semibold uppercase leading-none tracking-[0.14em]"
          >
            Trust
          </span>
        </a>
      </div>
    </div>
  );
}
