import { Badge } from "@/components/ui/badge";
import { CATEGORY_COLORS, CATEGORY_LABELS, type IssueCategory } from "@/lib/types";

export function CategoryBadge({ category }: { category: IssueCategory }) {
  const color = CATEGORY_COLORS[category];
  return (
    <Badge
      style={{ backgroundColor: `${color}1a`, color }}
      className="border-0"
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {CATEGORY_LABELS[category]}
    </Badge>
  );
}
