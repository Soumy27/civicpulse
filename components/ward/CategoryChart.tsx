"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { CATEGORY_COLORS, CATEGORY_LABELS, type Issue, type IssueCategory } from "@/lib/types";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export function CategoryChart({ issues }: { issues: Issue[] }) {
  const categories: IssueCategory[] = [
    "pothole",
    "water_leakage",
    "broken_streetlight",
    "garbage",
    "other",
  ];
  const counts = categories.map((c) => issues.filter((i) => i.category === c && !i.isPredicted).length);

  return (
    <Bar
      data={{
        labels: categories.map((c) => CATEGORY_LABELS[c]),
        datasets: [
          {
            label: "Issues",
            data: counts,
            backgroundColor: categories.map((c) => CATEGORY_COLORS[c]),
            borderRadius: 6,
          },
        ],
      }}
      options={{
        indexAxis: "y" as const,
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { precision: 0 }, grid: { display: false } },
          y: { grid: { display: false } },
        },
      }}
    />
  );
}
