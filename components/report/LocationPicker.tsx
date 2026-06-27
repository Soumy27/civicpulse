"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Crosshair, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reverseGeocode, searchPlaces } from "@/lib/maps";

const LeafletPicker = dynamic(() => import("./LeafletPicker"), {
  ssr: false,
  loading: () => <div className="shimmer h-72 w-full rounded-xl" />,
});

export interface PickedLocation {
  lat: number;
  lng: number;
  address: string;
}

export function LocationPicker({
  value,
  onChange,
}: {
  value: PickedLocation;
  onChange: (loc: PickedLocation) => void;
}) {
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const [searching, setSearching] = useState(false);

  const pick = async (lat: number, lng: number) => {
    onChange({ lat, lng, address: value.address }); // optimistic
    const address = await reverseGeocode(lat, lng);
    onChange({ lat, lng, address });
  };

  const useMyLocation = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        pick(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      (err) => {
        console.error("geolocation failed:", err);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults(await searchPlaces(query));
    setSearching(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" onClick={useMyLocation} disabled={locating} className="shrink-0">
          <Crosshair className={`h-4 w-4 ${locating ? "animate-spin" : ""}`} />
          {locating ? "Locating…" : "Use my location"}
        </Button>
        <div className="relative flex-1">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Search an address or landmark"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <Button variant="secondary" onClick={runSearch} disabled={searching} className="shrink-0">
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {results.length > 0 && (
            <ul className="absolute z-[1000] mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-card shadow-lg">
              {results.map((r, i) => (
                <li key={i}>
                  <button
                    onClick={() => {
                      onChange({ lat: r.lat, lng: r.lng, address: r.label });
                      setResults([]);
                      setQuery("");
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <LeafletPicker lat={value.lat} lng={value.lng} onPick={pick} />

      <div className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>{value.address || "Tap the map, search, or use your location to set the spot."}</span>
      </div>
    </div>
  );
}
