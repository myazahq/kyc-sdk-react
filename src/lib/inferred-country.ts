/**
 * The visitor's most likely country, for DEFAULTS only (never evidence).
 *
 * Two tiers: the server's IP-derived `geoCountry` when it exists, else the
 * browser locale's region subtag (en-NG → NG). The second tier is what makes
 * inference work where the IP cannot answer at all — local development
 * (loopback addresses geolocate to nothing) and networks GeoLite2 cannot
 * place — from a signal the browser already carries. Both are guesses a
 * person can correct; nothing recorded branches on them.
 */
export function inferredCountry(geoCountry?: string | null): string | null {
  const geo = geoCountry?.trim().toUpperCase();
  if (geo && /^[A-Z]{2}$/.test(geo)) return geo;
  if (typeof navigator === 'undefined') return null;
  try {
    for (const lang of navigator.languages ?? [navigator.language]) {
      const region = new Intl.Locale(lang).region?.toUpperCase();
      if (region && /^[A-Z]{2}$/.test(region)) return region;
    }
  } catch {
    // Malformed locale tags; fall through.
  }
  return null;
}
