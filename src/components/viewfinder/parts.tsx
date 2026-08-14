import { ScanLine, Loader2 } from 'lucide-react';
import { CountryFlag } from '../CountryFlag';
import { cn } from '../../lib/utils';

// The atoms both viewfinders are built from. Extracted so the full-screen and
// inline layouts differ only in ARRANGEMENT — a desktop capture that drew its
// own guide, its own badge and its own shutter is how the two drifted into
// looking like different products.

export const SCRIM = 'rgba(0,0,0,0.45)';

/**
 * Which side is being photographed. A two-sided capture must never leave that
 * ambiguous, which is why it is brand-filled rather than another dark pill.
 */
export function SideBadge({
  side,
  primaryColor,
  className,
  style,
}: {
  side: 'front' | 'back';
  primaryColor: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute z-20 rounded-full px-3.5 py-1.5',
        'text-xs font-bold uppercase tracking-widest text-white',
        className,
      )}
      style={{ backgroundColor: primaryColor, ...style }}
    >
      {side}
    </div>
  );
}

/**
 * Which document is expected, with its issuing country — the last point before
 * the shutter where someone can notice they have picked up the wrong document,
 * or the right document from the wrong country.
 *
 * The flag carries the country on its own: a name beside it is the same fact
 * twice, and the flag reads faster at a glance.
 */
export function DocumentPill({
  label,
  country,
  className,
  style,
}: {
  label: string;
  country?: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute left-1/2 z-20 flex max-w-[70%] -translate-x-1/2',
        'items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold',
        'text-white backdrop-blur-sm',
        className,
      )}
      style={{ backgroundColor: SCRIM, ...style }}
    >
      {country && <CountryFlag code={country} className="h-5 w-5 shrink-0" />}
      <span className="truncate">{label}</span>
    </div>
  );
}

export function HintPill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'max-w-[92%] rounded-full px-4 py-2.5 text-center text-sm font-medium',
        'text-white backdrop-blur-sm',
        className,
      )}
      style={{ backgroundColor: SCRIM }}
    >
      {children}
    </div>
  );
}

/**
 * The shutter. Manual capture always works — auto-capture is an assist, so a
 * user whose document will not lock on is never stranded.
 */
export function Shutter({
  onCapture,
  busy,
  primaryColor,
  size = 72,
}: {
  onCapture: () => void;
  busy: boolean;
  primaryColor: string;
  size?: number;
}) {
  const icon = size >= 64 ? 'h-7 w-7' : 'h-6 w-6';
  return (
    <button
      type="button"
      onClick={onCapture}
      disabled={busy}
      aria-label="Capture document"
      className={cn(
        'pointer-events-auto flex items-center justify-center rounded-full',
        'ring-4 ring-white transition-transform active:scale-95',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white',
        busy && 'opacity-70',
      )}
      style={{ backgroundColor: primaryColor, width: size, height: size }}
    >
      {busy ? (
        <Loader2 className={cn(icon, 'animate-spin text-white')} />
      ) : (
        <ScanLine className={cn(icon, 'text-white')} />
      )}
    </button>
  );
}
