/**
 * Free, no-API-key geocoding via OpenStreetMap's Nominatim.
 *
 * Usage-policy notes (nominatim.org/release-docs/latest/api/Search/):
 *  - max ~1 request/second - fine here since every call is a single
 *    user-triggered action (clicking "Search" / opening the edit modal),
 *    never fired on keystroke.
 *  - browsers can't override the User-Agent header from fetch(); Nominatim
 *    accepts the browser's Referer as identification for client-side apps.
 *  - results are © OpenStreetMap contributors - attribute wherever a
 *    resolved location is shown (see the modals using this).
 */
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

// The backend stores coordinates as DecimalField(decimal_places=6) - ~11cm
// precision, plenty for a dashboard pin. Nominatim often returns 7+ decimal
// places, which the API would otherwise reject with "Ensure that there are
// no more than 6 decimal places." Round once here, at the source.
const round6 = (n) => Math.round(Number(n) * 1e6) / 1e6;

/** Resolves a free-text place name (e.g. "Bengaluru") to coordinates. */
export async function geocodeSearch(query) {
  const q = query.trim();
  if (!q) return null;
  const url = `${NOMINATIM_BASE}/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Location lookup failed');
  const results = await res.json();
  if (!results.length) return null;
  const { lat, lon, display_name } = results[0];
  return { latitude: round6(lat), longitude: round6(lon), displayName: display_name };
}

/** Resolves coordinates back to a human-readable place name, for pre-filling the search field when editing an org that already has a location. */
export async function reverseGeocode(latitude, longitude) {
  const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Reverse lookup failed');
  const result = await res.json();
  return result?.display_name || null;
}
