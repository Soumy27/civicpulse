"use client";

import dynamic from "next/dynamic";
import type { Issue } from "@/lib/types";

// Leaflet uses window at import, so the real map is client-only.
const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="shimmer h-full min-h-[400px] w-full" />,
});

export function IssueMap({
  issues,
  onSelect,
  selectedId,
}: {
  issues: Issue[];
  onSelect: (issue: Issue) => void;
  selectedId?: string;
}) {
  return (
    <div className="relative h-full w-full">
      <LeafletMap issues={issues} onSelect={onSelect} selectedId={selectedId} />
    </div>
  );
}
