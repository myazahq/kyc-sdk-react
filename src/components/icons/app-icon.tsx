'use client';

import { forwardRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import type { HugeiconsIconProps, IconSvgElement } from '@hugeicons/react';

/**
 * The size scale, in pixels. Deliberately the SDK's own: its screens are
 * touch-first modals, not the dashboard's dense tables, so `md` here is the
 * dashboard's `xl`.
 */
export const ICON_SIZES = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export type AppIconSize = keyof typeof ICON_SIZES | number;
export type AppIconProps = Omit<HugeiconsIconProps, 'icon' | 'altIcon' | 'size'> & {
  size?: AppIconSize;
};
export type AppIconComponent = ReturnType<typeof createAppIcon>;

/**
 * The single rendering boundary for the SDK's icons — the same contract the
 * dashboard's `createAppIcon` keeps, so one glyph set and one stroke weight
 * read identically across the product: Hugeicons Stroke Rounded at a calm 1.6,
 * inheriting the surrounding text colour, decorative unless the caller supplies
 * an accessible name.
 *
 * The default size is 24 rather than the dashboard's 18 because every call site
 * here was written against Lucide's own 24px default. Almost all of them size
 * the glyph with a Tailwind class (`h-4 w-4`), which wins over the width/height
 * attributes either way; the default only governs the few that do not, and
 * shrinking those silently is exactly the kind of drift a swap like this
 * should not introduce.
 */
export function createAppIcon(icon: IconSvgElement, displayName: string) {
  const Component = forwardRef<SVGSVGElement, AppIconProps>(
    ({ size = 'lg', color = 'currentColor', strokeWidth = 1.6, ...props }, ref) => {
      const resolvedSize = typeof size === 'number' ? size : ICON_SIZES[size];
      const hasAccessibleName = Boolean(props['aria-label']);

      return (
        <HugeiconsIcon
          {...props}
          ref={ref}
          icon={icon}
          size={resolvedSize}
          color={color}
          strokeWidth={strokeWidth}
          aria-hidden={hasAccessibleName ? undefined : true}
          role={hasAccessibleName ? 'img' : undefined}
          focusable="false"
          data-icon={displayName}
        />
      );
    },
  );

  Component.displayName = displayName;
  return Component;
}
