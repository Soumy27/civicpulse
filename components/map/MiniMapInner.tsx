"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer } from "react-leaflet";

export default function MiniMapInner({ lat, lng }: { lat: number; lng: number }) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={16}
      className="h-full w-full"
      dragging={false}
      zoomControl={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
      <CircleMarker center={[lat, lng]} radius={9} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#2563eb", fillOpacity: 0.9 }} />
    </MapContainer>
  );
}
