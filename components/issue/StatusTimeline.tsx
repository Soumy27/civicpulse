import { Check } from "lucide-react";
import type { IssueStatus } from "@/lib/types";

const STAGES: { status: IssueStatus; label: string }[] = [
  { status: "reported", label: "Reported" },
  { status: "confirmed", label: "Confirmed" },
  { status: "in_progress", label: "In Progress" },
  { status: "resolved", label: "Resolved" },
];

const ORDER: Record<string, number> = {
  reported: 0,
  needs_review: 0,
  confirmed: 1,
  in_progress: 2,
  resolved: 3,
  closed: 3,
};

export function StatusTimeline({
  status,
  createdAt,
  updatedAt,
}: {
  status: IssueStatus;
  createdAt: number;
  updatedAt: number;
}) {
  const current = ORDER[status] ?? 0;

  return (
    <div className="flex items-center">
      {STAGES.map((stage, i) => {
        const done = i <= current;
        return (
          <div key={stage.status} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                  done ? "bg-green-600 text-white" : "bg-secondary text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={`text-[11px] ${done ? "font-medium" : "text-muted-foreground"}`}>
                {stage.label}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {i === 0
                  ? new Date(createdAt).toLocaleDateString()
                  : i === current
                    ? new Date(updatedAt).toLocaleDateString()
                    : ""}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`mx-1 h-0.5 flex-1 ${i < current ? "bg-green-600" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
