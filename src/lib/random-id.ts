/**
 * A random id that also works where `crypto.randomUUID` does not.
 *
 * `randomUUID` exists only in a SECURE context: https, or localhost. A phone on
 * the office wifi opening the dashboard on the Mac's LAN address is plain http
 * on a bare IP, and there the address search threw before it rendered because
 * it minted a Places session token with the bare call. `getRandomValues` has no
 * such restriction, so the fallback builds the same v4 shape from it; the last
 * resort is `Math.random`, which is fine for an id that only needs to be
 * unique within one browser session.
 */
export function randomId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
