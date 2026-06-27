"use client";

import { useCallback, useRef, useState } from "react";
import { GoogleMap, Marker, Autocomplete } from "@react-google-maps/api";
import { Crosshair, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INDORE_CENTER, useGoogleMaps } from "@/lib/useGoogleMaps";

export interface PickedLocation {
  lat: number;
  lng: number;
  address: string;
}

interface LocationPickerProps {
  value: PickedLocation;
  onChange: (loc: PickedLocation) => void;
}

const mapContainerStyle = { width: "100%", height: "320px", borderRadius: "0.75rem" };

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const { isLoaded, hasKey } = useGoogleMaps();
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [locating, setLocating] = useState(false);

  const reverseGeocode = useCallback(
    (lat: number, lng: number) => {
      if (typeof google === "undefined") {
        onChange({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
        return;
      }
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        const address =
          status === "OK" && results?.[0]
            ? results[0].formatted_address
            : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        onChange({ lat, lng, address });
      });
    },
    [onChange]
  );

  const useMyLocation = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      (err) => {
        console.error("geolocation failed:", err);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const onPlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace();
    const loc = place?.geometry?.location;
    if (loc) {
      onChange({
        lat: loc.lat(),
        lng: loc.lng(),
        address: place.formatted_address ?? place.name ?? "",
      });
    }
  };

  // Graceful fallback when no Maps key — manual lat/lng entry.
  if (!hasKey) {
    return (
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Maps unavailable (no API key). Enter coordinates manually:
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            step="any"
            value={value.lat}
            onChange={(e) => onChange({ ...value, lat: Number(e.target.value) })}
            className="rounded-lg border px-3 py-2 text-sm"
            placeholder="Latitude"
          />
          <input
            type="number"
            step="any"
            value={value.lng}
            onChange={(e) => onChange({ ...value, lng: Number(e.target.value) })}
            className="rounded-lg border px-3 py-2 text-sm"
            placeholder="Longitude"
          />
        </div>
        <input
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          className="w-full rounded-lg border px-3 py-2 text-sm"
          placeholder="Address"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={useMyLocation} disabled={locating} className="shrink-0">
          <Crosshair className={`h-4 w-4 ${locating ? "animate-spin" : ""}`} />
          {locating ? "Locating…" : "Use my location"}
        </Button>
        {isLoaded && (
          <Autocomplete
            onLoad={(ac) => (autocompleteRef.current = ac)}
            onPlaceChanged={onPlaceChanged}
            className="flex-1"
          >
            <input
              placeholder="Search for an address or landmark"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </Autocomplete>
        )}
      </div>

      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={{ lat: value.lat || INDORE_CENTER.lat, lng: value.lng || INDORE_CENTER.lng }}
          zoom={16}
          options={{ disableDefaultUI: true, zoomControl: true, gestureHandling: "greedy" }}
          onClick={(e) => {
            if (e.latLng) reverseGeocode(e.latLng.lat(), e.latLng.lng());
          }}
        >
          <Marker
            position={{ lat: value.lat || INDORE_CENTER.lat, lng: value.lng || INDORE_CENTER.lng }}
            draggable
            onDragEnd={(e) => {
              if (e.latLng) reverseGeocode(e.latLng.lat(), e.latLng.lng());
            }}
          />
        </GoogleMap>
      ) : (
        <div className="shimmer h-[320px] w-full rounded-xl" />
      )}

      <div className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>{value.address || "Drag the pin or search to set the exact location."}</span>
      </div>
    </div>
  );
}
