import { SearchParamToggle } from "@/components/dashboard/search-param-toggle";
import { RANGE_OPTIONS } from "@/lib/dates";

const LABELS: Record<number, string> = { 7: "7d", 28: "28d", 90: "3m", 180: "6m", 365: "12m" };

/** Writes `?days=` so the server component re-renders with the new range. */
export function RangePicker({ value }: { value: number }) {
  return (
    <SearchParamToggle
      param="days"
      value={String(value)}
      label="Date range"
      options={RANGE_OPTIONS.map((d) => ({ value: String(d), label: LABELS[d] }))}
    />
  );
}
