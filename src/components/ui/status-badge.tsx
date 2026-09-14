import { cn } from "@/lib/utils";
import type { StockStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: StockStatus }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
      status === "In Stock" && "bg-emerald-50 text-emerald-800",
      status === "Low Stock" && "bg-amber-50 text-amber-800",
      status === "Out of Stock" && "bg-red-50 text-red-700",
    )}>
      <span className={cn("size-1.5 rounded-full", status === "In Stock" && "bg-emerald-600", status === "Low Stock" && "bg-amber-500", status === "Out of Stock" && "bg-red-600")} aria-hidden="true" />
      {status}
    </span>
  );
}

