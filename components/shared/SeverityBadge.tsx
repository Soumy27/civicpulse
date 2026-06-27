import { Badge } from "@/components/ui/badge";
import type { Severity } from "@/lib/types";

const MAP: Record<Severity, { variant: "green" | "amber" | "red"; label: string }> = {
  low: { variant: "green", label: "Low" },
  medium: { variant: "amber", label: "Medium" },
  high: { variant: "red", label: "High" },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const { variant, label } = MAP[severity];
  return <Badge variant={variant}>{label} severity</Badge>;
}
