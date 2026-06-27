/**
 * Marker icon factory. Solid colored circles for real issues (sized by
 * severity), and a dashed amber ring for AI-predicted hotspots (FEATURE A).
 * Returns google.maps.Icon/Symbol configs — kept framework-agnostic so the
 * map component stays declarative.
 */
import { CATEGORY_COLORS, type Issue } from "@/lib/types";

const SEVERITY_PX: Record<Issue["severity"], number> = { low: 12, medium: 18, high: 24 };

/** Dashed amber ring as an inline SVG data URL for predicted issues. */
function predictedIcon(): google.maps.Icon {
  const size = 30;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 3}"
        fill="#f59e0b22" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="4 3" />
      <text x="50%" y="55%" text-anchor="middle" font-size="13" fill="#b45309" font-weight="bold">AI</text>
    </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

export function markerIcon(issue: Issue): google.maps.Symbol | google.maps.Icon {
  if (issue.isPredicted) return predictedIcon();
  const px = SEVERITY_PX[issue.severity];
  const dimmed = issue.status === "resolved" || issue.status === "closed";
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: px / 2,
    fillColor: CATEGORY_COLORS[issue.category],
    fillOpacity: dimmed ? 0.35 : 0.9,
    strokeColor: "#ffffff",
    strokeWeight: 2,
  };
}
