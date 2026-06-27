"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useCityMetrics } from "@/lib/hooks";
import { scoreColor } from "@/lib/score-utils";

const COLOR_CLASS = {
  green: "text-green-600",
  amber: "text-amber-500",
  red: "text-red-600",
} as const;

/** Animated count-up to the target value. */
function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export function CivicScoreHeader({ compact = false }: { compact?: boolean }) {
  const { data, loading } = useCityMetrics();
  const score = data?.civicScore ?? 0;
  const animated = useCountUp(score);

  if (loading && !data) {
    return <div className="shimmer h-12 w-40 rounded-lg" />;
  }

  const color = scoreColor(score);
  const delta = data?.weeklyDelta ?? 0;

  return (
    <div className={`flex items-center gap-3 ${compact ? "" : "rounded-xl border bg-card px-4 py-2"}`}>
      <div className="flex items-baseline gap-1">
        <span className={`text-4xl font-extrabold tabular-nums leading-none ${COLOR_CLASS[color]}`}>
          {animated}
        </span>
        <span className="text-lg font-medium text-muted-foreground">/100</span>
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Indore Civic Score
        </span>
        <span
          className={`flex items-center gap-1 text-xs font-medium ${
            delta >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {delta >= 0 ? "+" : ""}
          {delta} this week · {data?.totalResolvedThisMonth ?? 0} resolved
        </span>
      </div>
    </div>
  );
}
