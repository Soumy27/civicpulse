"use client";

import { useState } from "react";
import { GoogleMap, Marker } from "@react-google-maps/api";
import { INDORE_CENTER, useGoogleMaps } from "@/lib/useGoogleMaps";
import { markerIcon } from "./IssueMarker";
import { CATEGORY_LABELS, type Issue } from "@/lib/types";

const containerStyle = { width: "100%", height: "100%", minHeight: "400px" };

interface IssueMapProps {
  issues: Issue[];
  onSelect: (issue: Issue) => void;
  selectedId?: string;
}

export function IssueMap({ issues, onSelect, selectedId }: IssueMapProps) {
  const { isLoaded, hasKey, loadError } = useGoogleMaps();
  const [mapReady, setMapReady] = useState(false);

  // Text-list fallback if Maps fails / no key — keeps the demo alive.
  if (!hasKey || loadError) {
    return <IssueListFallback issues={issues} onSelect={onSelect} />;
  }

  if (!isLoaded) {
    return <div className="shimmer h-full min-h-[400px] w-full" />;
  }

  const visible = issues.filter((i) => !i.mergedIntoIssueId);

  return (
    <div className="relative h-full w-full">
      {!mapReady && <div className="shimmer absolute inset-0 z-10" />}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={INDORE_CENTER}
        zoom={14}
        onLoad={() => setMapReady(true)}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
          gestureHandling: "greedy",
        }}
      >
        {mapReady &&
          visible.map((issue) => (
            <Marker
              key={issue.id}
              position={{ lat: issue.lat, lng: issue.lng }}
              icon={markerIcon(issue)}
              zIndex={selectedId === issue.id ? 999 : issue.isPredicted ? 1 : 2}
              animation={
                selectedId === issue.id ? google.maps.Animation.BOUNCE : google.maps.Animation.DROP
              }
              onClick={() => onSelect(issue)}
              title={`${CATEGORY_LABELS[issue.category]} · ${issue.status}`}
            />
          ))}
      </GoogleMap>
    </div>
  );
}

function IssueListFallback({
  issues,
  onSelect,
}: {
  issues: Issue[];
  onSelect: (i: Issue) => void;
}) {
  return (
    <div className="h-full overflow-y-auto bg-secondary/40 p-3">
      <p className="mb-2 px-1 text-xs text-muted-foreground">
        Map unavailable — showing issues as a list.
      </p>
      <div className="space-y-2">
        {issues.map((i) => (
          <button
            key={i.id}
            onClick={() => onSelect(i)}
            className="w-full rounded-lg border bg-card p-3 text-left text-sm hover:bg-accent"
          >
            <span className="font-medium capitalize">{i.category.replace("_", " ")}</span> ·{" "}
            <span className="text-muted-foreground">{i.status}</span>
            <div className="text-xs text-muted-foreground">{i.address}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
