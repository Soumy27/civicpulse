/**
 * Geocoding + proximity helpers (Google Maps Geocoding API). Server-safe:
 * uses the REST endpoint with the public Maps key. Proximity math lives in
 * utils.ts (distanceMeters).
 */
import { distanceMeters } from "./utils";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

/** Reverse geocode lat/lng → human address. Falls back to a coord string. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  if (!key) return fallback;
  try {
    const url = `${GEOCODE_URL}?latlng=${lat},${lng}&key=${key}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      results: { formatted_address: string }[];
    };
    if (data.status === "OK" && data.results[0]) {
      return data.results[0].formatted_address;
    }
    return fallback;
  } catch (err) {
    console.error("reverseGeocode failed:", err);
    return fallback;
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
