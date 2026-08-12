'use client';

import { useCallback, useEffect, useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

/**
 * Position a dropdown so it escapes the step body's scroll container.
 *
 * The SDK's step body is `overflow-y-auto`, and an absolutely-positioned menu
 * inside a scroll container is CLIPPED by it — which is why the dial-code list
 * appeared to vanish behind the footer. `z-index` cannot fix that: it is
 * overflow clipping, not stacking.
 *
 * The menu therefore renders into `.kyc-root` (the dialog content element),
 * which sits ABOVE both the scrolling body and the footer, so the list can
 * overlay the footer as it should.
 *
 * Two constraints shape how it is positioned:
 *
 *   • NOT a Radix portal to `document.body`. Radix Dialog sets
 *     `pointer-events: none` on the body while open, so a menu portaled there
 *     is impossible to scroll or click. `.kyc-root` is inside the dialog, so it
 *     keeps pointer events and the focus trap.
 *   • NOT `position: fixed`. On desktop the dialog carries
 *     `xl:translate-x-[-50%]`, and a transformed ancestor becomes the
 *     containing block for fixed descendants — so viewport coordinates would be
 *     correct on mobile and wrong on desktop. Absolute coordinates measured
 *     RELATIVE to the host are right in both.
 *
 * It prefers to open downwards and shrinks its height budget to the room
 * available, so a long list scrolls rather than overflowing. When the trigger
 * sits near the bottom — a date field at the end of a long questionnaire — that
 * budget collapses to a sliver, so it FLIPS above instead. Flipping needs the
 * rendered height (to know where the top edge goes), which is why the caller
 * hands over the menu's ref and the position is refined once it has mounted.
 */
export interface DropdownAnchor {
  /** Portal target, or null before the trigger has mounted. */
  host: HTMLElement | null;
  /** Absolute placement within `host`. */
  style: CSSProperties;
  /** Room the list may occupy before it should scroll. */
  maxHeight: number;
}

interface Options {
  /**
   * Menu width in px, or `'trigger'` to match the control it hangs off (what a
   * full-width field select wants). Used to keep it inside the host's right
   * edge either way.
   */
  width?: number | 'trigger';
  /** Space between trigger and menu. */
  gap?: number;
  /** Breathing room kept against the host's edges. */
  margin?: number;
  /** Never squeeze the list below this, even in a tight spot. */
  minHeight?: number;
  /**
   * The menu element. Supplying it lets the menu open UPWARDS when there is no
   * room below — that placement needs its rendered height, so the position is
   * refined once it exists.
   */
  menuRef?: RefObject<HTMLElement | null>;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

export function useDropdownAnchor(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  { width = 288, gap = 6, margin = 12, minHeight = 120, menuRef }: Options = {},
): DropdownAnchor {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 288, maxHeight: 240 });

  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || !host) return;
    const hostRect = host.getBoundingClientRect();
    const rect = trigger.getBoundingClientRect();

    // Bound by the MODAL's edges as well as the viewport's, so the menu never
    // spills outside the dialog.
    const floor = Math.min(window.innerHeight, hostRect.bottom);
    const ceiling = Math.max(0, hostRect.top);
    const below = floor - rect.bottom - gap - margin;
    const above = rect.top - ceiling - gap - margin;

    // Decide against what the menu ACTUALLY needs, not a fixed floor. A date
    // picker wants ~320px; judging it against a 120px minimum meant "187px
    // below" counted as enough room and it opened downwards into a space it
    // could not fit, when there was three times as much above. `scrollHeight`
    // reports the content's natural height even while the box is clamped.
    // Zero on the first pass (the menu has not mounted) — the layout effect
    // re-measures once it has, and the trigger's position does not move, so
    // the decision cannot oscillate.
    const natural = menuRef?.current?.scrollHeight ?? 0;
    const needs = natural > 0 ? natural : minHeight;
    const placeAbove = below < needs && above > below;
    const maxHeight = Math.max(minHeight, placeAbove ? above : below);

    const menuWidth = width === 'trigger' ? rect.width : width;

    // Host-relative, so a transformed dialog is accounted for automatically.
    const left = clamp(
      rect.left - hostRect.left + host.scrollLeft,
      margin,
      Math.max(margin, host.clientWidth - menuWidth - margin),
    );

    // Opening upwards needs the menu's real height to know where its TOP goes,
    // capped at what will fit.
    const menuHeight = Math.min(natural || maxHeight, maxHeight);
    const top = placeAbove
      ? rect.top - hostRect.top + host.scrollTop - gap - menuHeight
      : rect.bottom - hostRect.top + host.scrollTop + gap;

    setPos((prev) =>
      prev.top === top && prev.left === left && prev.width === menuWidth && prev.maxHeight === maxHeight
        ? prev
        : { top, left, width: menuWidth, maxHeight },
    );
  }, [host, triggerRef, gap, margin, minHeight, width, menuRef]);

  // Resolve the host from the trigger rather than a context: the dialog root
  // carries `.kyc-root`, and this way the hook works for any anchored menu
  // without every caller having to thread a ref down.
  useLayoutEffect(() => {
    if (!open) return;
    const el = triggerRef.current?.closest('.kyc-root');
    setHost(el instanceof HTMLElement ? el : null);
  }, [open, triggerRef]);

  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  useEffect(() => {
    if (!open) return undefined;
    // Capture, so scrolling the step body (not just the window) repositions it.
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);

    // The menu's height decides where an upward placement starts, and it
    // changes as a list filters — so track it rather than measuring once.
    const el = menuRef?.current;
    const ro = el && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el!);

    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [open, measure, menuRef]);

  return {
    host,
    style: { position: 'absolute', top: pos.top, left: pos.left, width: pos.width },
    maxHeight: pos.maxHeight,
  };
}
