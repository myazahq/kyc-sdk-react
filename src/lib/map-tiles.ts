// Web Mercator math for the dependency-free map pin picker. Pure and
// unit-tested — the picker is a thin pointer-events shell over these.
//
// Deliberately NOT Leaflet: the SDK ships as a component library with its own
// compiled stylesheet, and a mapping dependency drags in global CSS, image
// assets and ~140KB for what the picker needs — pan, zoom, one pin. The
// standard slippy-map maths below is ~60 lines and fully testable.

export const TILE_SIZE = 256;
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 19;

// Web Mercator's poles — beyond this the projection diverges.
const MAX_LAT = 85.05112878;

export interface LatLng {
  lat: number;
  lng: number;
}

export function clampLat(lat: number): number {
  return Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
}

function wrapLng(lng: number): number {
  let l = lng;
  while (l > 180) l -= 360;
  while (l < -180) l += 360;
  return l;
}

/** World size in pixels at a zoom level. */
export function worldSize(zoom: number): number {
  return TILE_SIZE * 2 ** zoom;
}

/** Project a coordinate to world pixels at a zoom level. */
export function latLngToWorld(point: LatLng, zoom: number): { x: number; y: number } {
  const size = worldSize(zoom);
  const lat = clampLat(point.lat);
  const sin = Math.sin((lat * Math.PI) / 180);
  // Clamped into the world: at the pole cap the log term lands a float
  // epsilon outside [0, size], which would render as a phantom tile row.
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size;
  return {
    x: ((wrapLng(point.lng) + 180) / 360) * size,
    y: Math.min(size, Math.max(0, y)),
  };
}

/** Unproject world pixels back to a coordinate. */
export function worldToLatLng(x: number, y: number, zoom: number): LatLng {
  const size = worldSize(zoom);
  const n = Math.PI - (2 * Math.PI * y) / size;
  return {
    lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
    lng: wrapLng((x / size) * 360 - 180),
  };
}

export interface TilePlacement {
  key: string;
  url: string;
  /** CSS position relative to the viewport's top-left corner. */
  left: number;
  top: number;
}

/**
 * The OSM tiles covering a viewport centred on `center`. Tiles outside the
 * world (above/below the poles) are skipped; longitude wraps.
 */
export function visibleTiles(
  center: LatLng,
  zoom: number,
  width: number,
  height: number,
): TilePlacement[] {
  const world = latLngToWorld(center, zoom);
  const tiles: TilePlacement[] = [];
  const tileCount = 2 ** zoom;
  const originX = world.x - width / 2;
  const originY = world.y - height / 2;
  const first = { x: Math.floor(originX / TILE_SIZE), y: Math.floor(originY / TILE_SIZE) };
  const last = {
    x: Math.floor((originX + width) / TILE_SIZE),
    y: Math.floor((originY + height) / TILE_SIZE),
  };
  for (let ty = first.y; ty <= last.y; ty += 1) {
    if (ty < 0 || ty >= tileCount) continue;
    for (let tx = first.x; tx <= last.x; tx += 1) {
      const wrappedX = ((tx % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${zoom}/${tx}/${ty}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`,
        left: tx * TILE_SIZE - originX,
        top: ty * TILE_SIZE - originY,
      });
    }
  }
  return tiles;
}

/** The centre after a drag of (dx, dy) viewport pixels. */
export function panCenter(center: LatLng, zoom: number, dx: number, dy: number): LatLng {
  const world = latLngToWorld(center, zoom);
  const next = worldToLatLng(world.x - dx, world.y - dy, zoom);
  return { lat: clampLat(next.lat), lng: next.lng };
}

/** Sensible starting views: gov-DB countries at country zoom, else a world view. */
const COUNTRY_CENTERS: Record<string, LatLng> = {
  NG: { lat: 9.06, lng: 8.68 },
  GH: { lat: 7.95, lng: -1.02 },
  KE: { lat: 0.02, lng: 37.9 },
  ZA: { lat: -28.48, lng: 24.68 },
  CI: { lat: 7.54, lng: -5.55 },
};

export function defaultMapView(country: string | undefined): { center: LatLng; zoom: number } {
  const center = country ? COUNTRY_CENTERS[country.toUpperCase()] : undefined;
  return center ? { center, zoom: 6 } : { center: { lat: 6.5, lng: 12 }, zoom: 3 };
}
