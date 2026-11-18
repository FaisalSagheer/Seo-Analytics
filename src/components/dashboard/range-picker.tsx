import { DateRangeDialog, type DateRangeState } from "@/components/dashboard/date-range-dialog";
import { SearchParamToggle } from "@/components/dashboard/search-param-toggle";
import { BASIC_PRESETS, PERF_PRESETS, earliestDate } from "@/lib/date-range";
import { toDateKey, utcDay } from "@/lib/dates";

const LABELS: Record<number, string> = { 1: "24h", 7: "7d", 28: "28d" };

/**
 * Quick 7d / 28d buttons (plus 24h on pages with live data) and a Date range dialog for the
 * longer ranges. `advanced` adds custom dates, 16 months and comparison; it needs a page that reads live data.
 */
export function RangePicker({
  value,
  advanced = false,
  custom,
  compare,
}: {
  value: number;
  advanced?: boolean;
  custom?: { from: string; to: string };
  compare?: DateRangeState["compare"];
}) {
  const quick = advanced ? [1, 7, 28] : [7, 28];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchParamToggle
        param="days"
        value={custom ? "" : String(value)}
        label="Date range"
        options={quick.map((d) => ({ value: String(d), label: LABELS[d] }))}
        // A quick button replaces any custom dates
        clear={["from", "to"]}
      />
      <DateRangeDialog
        days={value}
        from={custom?.from}
        to={custom?.to}
        compare={compare ?? { kind: "none" }}
        presets={advanced ? PERF_PRESETS : BASIC_PRESETS}
        allowCustom={advanced}
        allowCompare={advanced}
        minDate={toDateKey(earliestDate())}
        maxDate={toDateKey(utcDay())}
      />
    </div>
  );
}
