import { Badge } from "@/components/ui/badge";

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const variant = confidence >= 70 ? "green" : confidence >= 50 ? "amber" : "red";
  return <Badge variant={variant}>{Math.round(confidence)}% confidence</Badge>;
}

/** Horizontal confidence bar used on detail pages. */
export function ConfidenceBar({ confidence }: { confidence: number }) {
  const color = confidence >= 70 ? "#22c55e" : confidence >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>AI confidence</span>
        <span className="font-semibold">{Math.round(confidence)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(0, Math.min(100, confidence))}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
