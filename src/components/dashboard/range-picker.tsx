import { SearchParamToggle } from "@/components/dashboard/search-param-toggle";
import { RANGE_OPTIONS } from "@/lib/dates";

const LABELS: Record<number, string> = { 1: "24h", 7: "7d", 28: "28d", 90: "3m", 180: "6m", 365: "12m" };

/** Writes `?days=` so the server component re-renders with the new range. */
export function RangePicker({ value, includeDay = false }: { value: number; includeDay?: boolean }) {
  const options = includeDay ? [1, ...RANGE_OPTIONS] : RANGE_OPTIONS;
  return (
    <SearchParamToggle
      param="days"
      value={String(value)}
      label="Date range"
      options={options.map((d) => ({ value: String(d), label: LABELS[d] }))}
    />
  );
}
