import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A change value with an arrow + sign so direction never relies on colour.
 * `value` is already oriented: positive = better.
 */
export function Delta({ value, suffix = "", digits = 0, className }: {
  value: number | null;
  suffix?: string;
  digits?: number;
  className?: string;
}) {
  if (value == null) return <span className={cn("text-muted-foreground", className)}>—</span>;
  const rounded = Number(value.toFixed(digits));
  const Icon = rounded > 0 ? ArrowUpIcon : rounded < 0 ? ArrowDownIcon : MinusIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-sm font-medium tabular-nums",
        getDeltaTone(rounded),
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {Math.abs(rounded).toFixed(digits)}
      {suffix}
      <span className="sr-only">{rounded > 0 ? "improved" : rounded < 0 ? "declined" : "unchanged"}</span>
    </span>
  );
}

function getDeltaTone(v: number) {
  if (v > 0) return "text-success";
  if (v < 0) return "text-danger";
  return "text-muted-foreground";
}
