'use client';

import React, { type ReactElement, type RefObject } from 'react';
import { RemoveScroll } from 'react-remove-scroll';
// PINNED to the exact version @radix-ui/react-dialog depends on. Radix pins its
// internals exactly, and two copies of this package mean two focus-scope stacks
// — at which point the dialog's scope is never paused and the fix below silently
// stops working. dropdown-surface.test.ts asserts the two stay in step.
import { FocusScope } from '@radix-ui/react-focus-scope';

/**
 * Makes a body-portalled menu usable inside the dialog.
 *
 * Our menus portal to the body so they can escape the dialog's overflow, and
 * the dialog defends itself against exactly that: two of its guards treat
 * anything outside its content element as hostile.
 *
 * SCROLLING. Radix locks the page with `react-remove-scroll`, allowing only its
 * own content as a "shard" and preventDefaulting `wheel` and `touchmove`
 * everywhere else. The list could be moved only by dragging its scrollbar thumb
 * — and on a phone, where there is no thumb, not at all.
 *
 * FOCUS. Radix also traps focus: on any `focusin` outside its content it pulls
 * focus straight back. Buttons still fired, because a click completes wherever
 * focus ends up, but the search input could never HOLD focus — so the list
 * looked clickable while the search box appeared dead. That asymmetry is the
 * signature of a focus trap, not of a click handler.
 *
 * Both guards are stacks, and only the topmost member acts. Mounting our own
 * pair takes over while the menu is open and hands back on close, which is what
 * Radix itself does for its portalled Select. The focus scope is deliberately
 * NOT `trapped`: we only need the dialog's to stand down, and trapping would
 * mean Tab could not leave a menu the user is trying to leave.
 *
 * `forwardProps` clones the single child rather than adding a wrapper element,
 * so the positioned menu stays the direct child of the portal.
 *
 * THE MENU'S REF MUST COME THROUGH HERE, not off the child. Cloning REPLACES
 * the child's ref with the lock's own, which left every caller holding null —
 * and each of them asks `menuRef.current?.contains(target)` to decide whether a
 * click landed outside. Null contains nothing, so every click inside the menu
 * read as outside and closed it before it could land. RemoveScroll merges a
 * forwarded ref with its own, so passing it here gives both what they need.
 */
export function DropdownSurface({
  menuRef,
  children,
}: {
  menuRef: RefObject<HTMLDivElement | null>;
  children: ReactElement;
}) {
  return (
    // The scope's own element wraps rather than replaces the menu (display:
    // contents, so it has no box at all) — keeping it separate avoids two
    // libraries cloning one child.
    //
    // Both auto-focus behaviours are suppressed: every menu already focuses its
    // own search box on open, and this component's whole job is to make the
    // guards stand down, not to take over focus management from the callers.
    // Registering the scope is what pauses the dialog's; the rest is theirs.
    <FocusScope
      trapped={false}
      className="contents"
      onMountAutoFocus={(e) => e.preventDefault()}
      onUnmountAutoFocus={(e) => e.preventDefault()}
    >
      <RemoveScroll ref={menuRef as RefObject<HTMLDivElement>} forwardProps>
        {children}
      </RemoveScroll>
    </FocusScope>
  );
}
