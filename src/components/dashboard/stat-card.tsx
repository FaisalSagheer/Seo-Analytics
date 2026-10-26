import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Delta } from "@/components/dashboard/delta";

export function StatCard({
  label,
  value,
  delta,
  deltaSuffix,
  deltaDigits,
  hint,
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaSuffix?: string;
  deltaDigits?: number;
  hint?: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="flex items-baseline gap-2 text-2xl font-semibold tabular-nums group-data-[size=sm]/card:text-2xl">
          {value}
          {delta !== undefined && <Delta value={delta} suffix={deltaSuffix} digits={deltaDigits} />}
        </CardTitle>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </CardHeader>
    </Card>
  );
}
