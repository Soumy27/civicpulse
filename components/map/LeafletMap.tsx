"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer } from "react-leaflet";
import { CATEGORY_COLORS, CATEGORY_LABELS, type Issue } from "@/lib/types";

const SEVERITY_RADIUS: Record<Issue["severity"], number> = { low: 6, medium: 9, high: 12 };

const INDORE: [number, number] = [
  Number(process.env.NEXT_PUBLIC_DEFAULT_LAT ?? 22.7196),
  Number(process.env.NEXT_PUBLIC_DEFAULT_LNG ?? 75.8577),
];

/**
 * The real Leaflet map. Loaded only on the client (via next/dynamic ssr:false
 * in IssueMap) because Leaflet touches `window` at import. Uses free OSM tiles,
 * vector CircleMarkers (no marker-image assets needed). Predicted hotspots get
 * a dashed amber ring.
 */
export default function LeafletMap({
  issues,
  onSelect,
  selectedId,
}: {
  issues: Issue[];
  onSelect: (issue: Issue) => void;
  selectedId?: string;
}) {
  const visible = issues.filter((i) => !i.mergedIntoIssueId);
  return (
    <MapContainer center={INDORE} zoom={14} className="h-full w-full" style={{ minHeight: 400 }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      {visible.map((i) => {
        const color = CATEGORY_COLORS[i.category];
        const dimmed = i.status === "resolved" || i.status === "closed";
        return (
          <CircleMarker
            key={i.id}
            center={[i.lat, i.lng]}
            radius={i.isPredicted ? 11 : SEVERITY_RADIUS[i.severity]}
            pathOptions={
              i.isPredicted
                ? { color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.15, weight: 2.5, dashArray: "4 3" }
                : {
                    color: "#ffffff",
                    weight: 2,
                    fillColor: color,
                    fillOpacity: selectedId === i.id ? 1 : dimmed ? 0.35 : 0.9,
                  }
            }
            eventHandlers={{ click: () => onSelect(i) }}
          >
            <title>{`${CATEGORY_LABELS[i.category]} · ${i.status}`}</title>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
