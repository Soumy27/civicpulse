import { Badge } from "@/components/ui/badge";
import type { IssueStatus } from "@/lib/types";

const MAP: Record<IssueStatus, { variant: "default" | "secondary" | "amber" | "green" | "red" | "blue"; label: string }> = {
  reported: { variant: "blue", label: "Reported" },
  confirmed: { variant: "amber", label: "Confirmed" },
  in_progress: { variant: "amber", label: "In Progress" },
  resolved: { variant: "green", label: "Resolved" },
  closed: { variant: "secondary", label: "Closed" },
  needs_review: { variant: "red", label: "Needs Review" },
  predicted: { variant: "amber", label: "Predicted" },
};

export function StatusBadge({ status }: { status: IssueStatus }) {
  const { variant, label } = MAP[status] ?? MAP.reported;
  return <Badge variant={variant}>{label}</Badge>;
}
