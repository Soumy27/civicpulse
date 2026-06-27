import { Card } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  accent = "text-foreground",
  icon,
}: {
  label: string;
  value: string | number;
  accent?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon}
      </div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${accent}`}>{value}</div>
    </Card>
  );
}
