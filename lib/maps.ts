/**
 * Geocoding + proximity helpers (Google Maps Geocoding API). Server-safe:
 * uses the REST endpoint with the public Maps key. Proximity math lives in
 * utils.ts (distanceMeters).
 */
import { distanceMeters } from "./utils";

export const INDORE_CENTER = {
  lat: Number(process.env.NEXT_PUBLIC_DEFAULT_LAT ?? 22.7196),
  lng: Number(process.env.NEXT_PUBLIC_DEFAULT_LNG ?? 75.8577),
};

// OpenStreetMap Nominatim — free, no key, no billing. Be polite: one request
// per action (we only call it on pin drop / search), and send a UA per policy.
const NOMINATIM = "https://nominatim.openstreetmap.org";

/** Reverse geocode lat/lng → human address. Falls back to a coord string. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  try {
    const url = `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { "User-Agent": "CivicPulse/1.0" } });
    const data = (await res.json()) as { display_name?: string };
    return data.display_name ?? fallback;
  } catch (err) {
    console.error("reverseGeocode failed:", err);
    return fallback;
  }
}

/** Forward geocode / place search (replaces Places autocomplete). */
export async function searchPlaces(
  query: string
): Promise<{ label: string; lat: number; lng: number }[]> {
  if (!query.trim()) return [];
  try {
    const url = `${NOMINATIM}/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=5`;
    const res = await fetch(url, { headers: { "User-Agent": "CivicPulse/1.0" } });
    const data = (await res.json()) as { display_name: string; lat: string; lon: string }[];
    return data.map((d) => ({ label: d.display_name, lat: Number(d.lat), lng: Number(d.lon) }));
  } catch (err) {
    console.error("searchPlaces failed:", err);
    return [];
  }
}

/**
 * A lat/lng bounding box for a radius (meters) around a center. Firestore
 * can't do true geo queries, so we filter a bounding box server-side then
 * refine with haversine. Returns degree deltas.
 */
export function boundingBox(lat: number, lng: number, radiusMeters: number) {
  const latDelta = radiusMeters / 111_320; // meters per degree latitude
  const lngDelta = radiusMeters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

/** Refine a candidate list to those truly within radius. */
export function withinRadius<T extends { lat: number; lng: number }>(
  items: T[],
  lat: number,
  lng: number,
  radiusMeters: number
): T[] {
  return items.filter((i) => distanceMeters(lat, lng, i.lat, i.lng) <= radiusMeters);
}

/** Naive ward inference for the demo — Indore wards keyed by a coarse grid. */
export function inferWardId(lat: number, lng: number): string {
  // Bucket into a small grid around Indore center so seeded points map to
  // a handful of stable ward ids.
  const latBucket = Math.round((lat - 22.7) * 200);
  const lngBucket = Math.round((lng - 75.85) * 200);
  const idx = Math.abs((latBucket * 7 + lngBucket * 13) % 5) + 1;
  return `ward-${idx}`;
}
