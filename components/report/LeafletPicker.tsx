"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

function ClickAndRecenter({ lat, lng, onPick }: { lat: number; lng: number; onPick: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Click-to-set location picker. Client-only (Leaflet needs window). */
export default function LeafletPicker({
  lat,
  lng,
  onPick,
}: {
  lat: number;
  lng: number;
  onPick: (lat: number, lng: number) => void;
}) {
  return (
    <MapContainer center={[lat, lng]} zoom={16} className="h-72 w-full rounded-xl" style={{ minHeight: 288 }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
      <CircleMarker center={[lat, lng]} radius={9} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#2563eb", fillOpacity: 0.85 }} />
      <ClickAndRecenter lat={lat} lng={lng} onPick={onPick} />
    </MapContainer>
  );
}
