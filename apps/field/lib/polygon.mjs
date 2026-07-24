// Wouri field: build a plot boundary polygon by walking it. Pure ESM, no deps, so
// the Expo screen and the Node self-test import the exact same code. Points are
// collected as {lat, lng} while the agent walks the perimeter; buildRing closes the
// ring into GeoJSON that create_lot_at_origin accepts, and the server (0035) computes
// the authoritative area. ringAreaHa is a local-projection estimate for on-device
// display only; it is never the value of record. No em-dashes.

const R_LAT_M = 110540; // metres per degree latitude
const R_LNG_M = 111320; // metres per degree longitude at the equator

export function isClosable(points) {
  return Array.isArray(points) && points.length >= 3;
}

// GeoJSON Polygon with a closed ring (first point repeated last). Coordinates are
// [lng, lat], the GeoJSON order.
export function buildRing(points) {
  if (!isClosable(points)) throw new Error('a plot boundary needs at least 3 points');
  const ring = points.map((p) => [p.lng, p.lat]);
  const [lng0, lat0] = ring[0];
  const [lngN, latN] = ring[ring.length - 1];
  if (lng0 !== lngN || lat0 !== latN) ring.push([lng0, lat0]);
  return { type: 'Polygon', coordinates: [ring] };
}

// Shoelace area in hectares via an equirectangular projection at the ring's mean
// latitude. Good enough to show the agent a number in the field; the server decides.
export function ringAreaHa(points) {
  if (!isClosable(points)) return 0;
  const meanLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const k = Math.cos((meanLat * Math.PI) / 180) * R_LNG_M;
  const xy = points.map((p) => ({ x: p.lng * k, y: p.lat * R_LAT_M }));
  let a = 0;
  for (let i = 0; i < xy.length; i++) {
    const j = (i + 1) % xy.length;
    a += xy[i].x * xy[j].y - xy[j].x * xy[i].y;
  }
  return Math.abs(a) / 2 / 10000; // m^2 -> hectares
}

export function centroid(points) {
  if (!points?.length) return null;
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
    lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
  };
}
