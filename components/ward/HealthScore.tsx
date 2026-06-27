import { scoreColor } from "@/lib/score-utils";

const COLOR = {
  green: { ring: "#22c55e", text: "text-green-600" },
  amber: { ring: "#f59e0b", text: "text-amber-500" },
  red: { ring: "#ef4444", text: "text-red-600" },
} as const;

export function HealthScore({ score }: { score: number }) {
  const c = COLOR[scoreColor(score)];
  const circumference = 2 * Math.PI * 52;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke={c.ring}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-3xl font-extrabold ${c.text}`}>{score}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Health</span>
      </div>
    </div>
  );
}
