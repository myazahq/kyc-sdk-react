// The one Google Maps JS loader (moved out of GoogleMapPicker when Street
// View joined it as a second consumer). Loads once per document, retries
// after a transient failure, and warns loudly on an auth refusal — the silent
// OSM fallback otherwise reads as "maps is broken" with no clue that it is
// the KEY's Website restrictions.

export interface GoogleMapInstance {
  setCenter(c: { lat: number; lng: number }): void;
  addListener(event: string, handler: () => void): void;
  getCenter(): { lat(): number; lng(): number } | undefined;
  setZoom(z: number): void;
}

export interface PanoramaInstance {
  getPano(): string;
  getPov(): { heading: number; pitch: number };
  getZoom(): number;
  addListener(event: string, handler: () => void): void;
}

export interface GoogleMapsApi {
  Map: new (el: HTMLElement, opts: object) => GoogleMapInstance;
  StreetViewPanorama: new (el: HTMLElement, opts: object) => PanoramaInstance;
  StreetViewService: new () => {
    getPanorama(req: object): Promise<{ data: { location?: { pano?: string; latLng?: unknown } } }>;
  };
}

declare global {
  interface Window {
    google?: { maps?: GoogleMapsApi };
    gm_authFailure?: () => void;
  }
}

let loaderPromise: Promise<GoogleMapsApi> | null = null;

// Google validates the key AFTER the script has loaded and a map has been
// constructed, so by the time it calls gm_authFailure the load promise has
// long since resolved and rejecting it does nothing. The failure is therefore
// kept as its own sticky signal: mounts that are already up subscribe to it
// and swap to the built-in map, and every later load on this page rejects at
// once instead of injecting Google's own error panel a second time. A key
// refused for an origin stays refused for the life of the page.
let authFailed = false;
const authFailureListeners = new Set<() => void>();

/** Subscribe to the key being refused; fires immediately if it already was. */
export function onGoogleMapsAuthFailure(listener: () => void): () => void {
  if (authFailed) listener();
  authFailureListeners.add(listener);
  return () => authFailureListeners.delete(listener);
}

function recordAuthFailure(): void {
  authFailed = true;
  loaderPromise = null;
  for (const l of authFailureListeners) l();
}

export function loadGoogleMaps(apiKey: string): Promise<GoogleMapsApi> {
  if (authFailed) return Promise.reject(new Error('maps_auth_failed'));
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
    window.gm_authFailure = () => {
      console.warn(
        `[myaza-kyc] Google Maps refused the API key for ${window.location.origin}. ` +
          "Add this origin to the key's Website restrictions in the Google console " +
          '(e.g. "http://localhost:3002/*" for local dev). Showing the built-in map instead.',
      );
      recordAuthFailure();
      reject(new Error('maps_auth_failed'));
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.onload = () => {
      const api = window.google?.maps;
      if (api?.Map) resolve(api);
      else reject(new Error('maps_unavailable'));
    };
    script.onerror = () => reject(new Error('maps_script_failed'));
    document.head.appendChild(script);
  });
  loaderPromise.catch(() => {
    loaderPromise = null; // a later mount may retry (transient network)
  });
  return loaderPromise;
}
