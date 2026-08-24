'use client';

// The handoff QR, drawn rather than stamped.
//
// A default QR is a wall of black squares — it reads as machine output, at the
// one moment we are asking someone to trust an unfamiliar third party with a
// passport. Rounded modules, softened finder patterns and our mark at the centre
// make it read as part of the product.
//
// Drawn from the module matrix instead of using qrcode.react, which merges every
// module into one <path> and so cannot express per-module shape. The encoder
// underneath (qrcode-generator) is tiny and dependency-free.
import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/** The three big squares. Their geometry is fixed by the spec, at 7x7 each. */
const FINDER = 7;

// A QR is read by a camera, not by a person, so it does not get to follow the
// theme: it needs maximum contrast on its own light ground in every case. These
// are deliberately fixed rather than `currentColor`, which inherited the modal's
// foreground and rendered light-grey dots on the white tile in dark mode.
const MODULE_COLOR = '#0A0A0A';
const GROUND_COLOR = '#FFFFFF';

/**
 * Quiet zone, in modules, drawn INSIDE the svg.
 *
 * Two, not the spec's four: every module of margin makes the payload modules
 * smaller at a fixed on-screen size, and a code that is pretty but unreadable is
 * worse than one with a thin margin. Carrying it here rather than relying on the
 * container's padding is what lets the container's padding shrink, which is
 * where the pixels for a scannable code come from.
 */
const QUIET = 2;

/**
 * The floor for a code a phone can actually read.
 *
 * Round modules carry less ink than squares, so this renderer needs more room
 * per module than a stock QR does. Measured, not guessed: with the logo and a
 * ~50-module payload it decodes down to about 4px per module and fails below
 * it — at the 172px a caller previously asked for, it did not decode at all.
 */
const MIN_PX_PER_MODULE = 4;

export interface StyledQRCodeProps {
  value: string;
  size?: number;
  /** Rendered at the centre, over cleared modules. */
  logo?: string;
  className?: string;
  title?: string;
}

/**
 * Whether a module belongs to one of the three finder patterns.
 *
 * They are drawn as shapes in their own right, so the dot renderer has to skip
 * them — otherwise the corners come out as blobs of separate dots and scanners
 * lose the very landmarks they use to locate the code.
 */
function inFinder(row: number, col: number, count: number): boolean {
  const far = count - FINDER;
  return (
    (row < FINDER && col < FINDER) ||
    (row < FINDER && col >= far) ||
    (row >= far && col < FINDER)
  );
}

/** One finder: rounded outer ring plus a rounded inner block. */
function Finder({ row, col }: { row: number; col: number }) {
  return (
    <g>
      {/* Chunkier than one module: at a phone's working distance a hairline
          ring loses the corner, and the finders are what a scanner locates the
          code by. */}
      <rect
        x={col + 0.6}
        y={row + 0.6}
        width={5.8}
        height={5.8}
        rx={2}
        ry={2}
        fill="none"
        stroke={MODULE_COLOR}
        strokeWidth={1.2}
      />
      <rect x={col + 2} y={row + 2} width={3} height={3} rx={1.1} ry={1.1} fill={MODULE_COLOR} />
    </g>
  );
}

export function StyledQRCode({ value, size = 240, logo, className, title }: StyledQRCodeProps) {
  const { count, dark } = useMemo(() => {
    // Type 0 = pick the smallest version that fits. Level H (30% recovery),
    // which is what pays for the cleared centre the logo sits in.
    const qr = qrcode(0, 'H');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const grid: boolean[][] = [];
    for (let r = 0; r < n; r++) {
      grid.push(Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
    }
    return { count: n, dark: grid };
  }, [value]);

  // The cleared square the logo occupies, in modules. 26% of the WIDTH is ~6.8%
  // of the area — level H recovers 30%, so this sits well inside the budget even
  // after the finders and timing patterns take their share. Past roughly a third
  // of the width, scans start failing in poor light.
  const logoModules = logo ? Math.round(count * 0.26) : 0;
  const logoStart = Math.floor((count - logoModules) / 2);
  const logoEnd = logoStart + logoModules;
  const inLogo = (r: number, c: number) =>
    logoModules > 0 && r >= logoStart && r < logoEnd && c >= logoStart && c < logoEnd;

  const dots: React.ReactNode[] = [];
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!dark[r][c] || inFinder(r, c, count) || inLogo(r, c)) continue;
      // Circles rather than squares, at very nearly a full module. 0.42 left
      // them looking sparse and faint; this keeps the hairline gap that makes
      // the dot pattern read while restoring the ink a camera needs.
      dots.push(<circle key={`${r}-${c}`} cx={c + 0.5} cy={r + 0.5} r={0.48} />);
    }
  }

  const far = count - FINDER;
  // An SVG scales perfectly, but the camera only sees the ON-SCREEN size, so
  // rendering small is what breaks scanning. Enforced here rather than left to
  // each caller: the module count grows with the URL, so a size that is fine
  // today can silently stop decoding when a token gets longer.
  const total = count + QUIET * 2;
  const rendered = Math.max(size, total * MIN_PX_PER_MODULE);

  return (
    <svg
      viewBox={`${-QUIET} ${-QUIET} ${total} ${total}`}
      width={rendered}
      height={rendered}
      className={className}
      role="img"
      aria-label={title ?? 'QR code'}
      shapeRendering="geometricPrecision"
    >
      {/* The code carries its own ground and quiet zone, so it is legible on any
          surface the consumer puts it on and never depends on a parent's
          background to be scannable. */}
      <rect x={-QUIET} y={-QUIET} width={total} height={total} rx={2} fill={GROUND_COLOR} />
      <g fill={MODULE_COLOR}>{dots}</g>
      <Finder row={0} col={0} />
      <Finder row={0} col={far} />
      <Finder row={far} col={0} />
      {logo && logoModules > 0 && (
        <image
          href={logo}
          x={logoStart}
          y={logoStart}
          width={logoModules}
          height={logoModules}
          // The modules underneath are already cleared, so nothing is being
          // covered up — this sits in a hole made for it.
          preserveAspectRatio="xMidYMid meet"
        />
      )}
    </svg>
  );
}
