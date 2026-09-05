import React from 'react';
import { cn } from '../lib/utils';

/**
 * A step's primary actions, held at the bottom edge of the scrolling body.
 *
 * A step that carries a map or a street panorama fills a phone with a surface
 * that OWNS every touch: dragging it moves the map, never the page, so on a
 * small screen the Continue button beneath it could only be reached by finding
 * a strip of margin to scroll on. Holding the actions at the bottom of the
 * scroll container means the applicant never has to get past the map to move
 * on, and everything else still scrolls under them.
 *
 * Sticky rather than fixed: the bar sits in flow when the step is short enough
 * to fit, and pins to the edge only when there is something to scroll under
 * it. The negative margins cancel the body's padding so the bar meets the edge,
 * and the same padding is restored inside so the buttons keep their gutter.
 * The sticky offset is `-bottom-6` for the same reason: `bottom-0` measures
 * from the body's content box, so the bar stuck one padding short of the edge
 * with a strip of content showing beneath it.
 */
export function StickyActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'sticky -bottom-6 z-10 -mx-6 -mb-6 bg-background/90 px-6 pb-6 pt-3 backdrop-blur-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}
