"use client";

import { useJsApiLoader } from "@react-google-maps/api";

/** Libraries we use across the app: places (autocomplete) + marker (advanced). */
const LIBRARIES: ("places" | "marker")[] = ["places", "marker"];

/**
 * Shared Maps JS API loader. Centralizing the id + libraries avoids the
 * "Loader must not be called again with different options" runtime error.
 */
export function useGoogleMaps() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded, loadError } = useJsApiLoader({
    id: "civicpulse-gmaps",
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });
  return { isLoaded: isLoaded && Boolean(apiKey), loadError, hasKey: Boolean(apiKey) };
}

export const INDORE_CENTER = {
  lat: Number(process.env.NEXT_PUBLIC_DEFAULT_LAT ?? 22.7196),
  lng: Number(process.env.NEXT_PUBLIC_DEFAULT_LNG ?? 75.8577),
};
