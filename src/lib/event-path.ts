/**
 * Whether a document-level event originated inside any of the given elements.
 *
 * `e.target` alone cannot answer this from OUTSIDE a shadow root: an event
 * crossing the boundary is RETARGETED to the shadow host, so to a `document`
 * listener a click on a dropdown row reports the HOST element and
 * `menu.contains(target)` says no. Every outside-click guard built on that
 * check therefore closed its menu on pointerdown and swallowed the row's
 * click — no dropdown in the SDK could select anything once the SDK started
 * mounting in its style-isolation shadow frame (lib/sdk-frame.tsx).
 *
 * `composedPath()` carries the REAL path across open shadow roots, so the
 * containment test is run against it; the retargeted-target check remains as
 * the fallback for any environment without composedPath.
 */
export function eventPathIncludes(e: Event, ...els: Array<Element | null>): boolean {
  const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
  if (path.length > 0) return els.some((el) => el != null && path.includes(el));
  const t = e.target as Node | null;
  return els.some((el) => el != null && t != null && el.contains(t));
}
