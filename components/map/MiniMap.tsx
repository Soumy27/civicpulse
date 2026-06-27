"use client";

import dynamic from "next/dynamic";

const MiniMapInner = dynamic(() => import("./MiniMapInner"), {
  ssr: false,
  loading: () => <div className="shimmer h-full w-full" />,
});

/** Small read-only map showing a single point. */
export function MiniMap({ lat, lng }: { lat: number; lng: number }) {
  return <MiniMapInner lat={lat} lng={lng} />;
}
