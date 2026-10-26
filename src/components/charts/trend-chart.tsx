"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { formatDate, formatNumber, formatPercent, formatPosition } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ValueFormat = "number" | "position" | "percent" | "score";

export type TrendSeries = { key: string; label: string; color: string };

function formatValue(v: unknown, format: ValueFormat) {
  if (typeof v !== "number") return "—";
  switch (format) {
    case "position":
      return formatPosition(Number(v.toFixed(1)));
    case "percent":
      return formatPercent(v);
    case "score":
      return v.toFixed(1);
    default:
      return formatNumber(v);
  }
}

/**
 * One-axis line chart over dates. Measures on different scales belong in
 * separate TrendCharts stacked with a shared x-axis, never on a second y-axis.
 */
export function TrendChart({
  data,
  series,
  format = "number",
  reversed = false,
  height = 240,
  emptyMessage = "No data for this range yet.",
  syncId,
  className,
}: {
  /** Charts sharing a syncId move their hover crosshair together */
  syncId?: string;
  data: Record<string, string | number | null>[];
  series: TrendSeries[];
  format?: ValueFormat;
  /** For rank positions: 1 at the top */
  reversed?: boolean;
  height?: number;
  emptyMessage?: string;
  className?: string;
}) {
  // An all-null or all-zero series draws as a flat line on the axis, which
  // reads as broken. Treat it as empty.
  const hasData = data.some((row) => series.some((s) => typeof row[s.key] === "number" && row[s.key] !== 0));
  if (!hasData) {
    return (
      <Empty className="border" style={{ minHeight: height }}>
        <EmptyHeader>
          <EmptyTitle>Nothing to chart</EmptyTitle>
          <EmptyDescription>{emptyMessage}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const config = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])) satisfies ChartConfig;

  return (
    <ChartContainer config={config} className={cn("w-full", className)} style={{ height }}>
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }} syncId={syncId} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={(v: string) => formatDate(v)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          reversed={reversed}
          // Positions: fit the data with a little headroom (never above #1) so movement is visible
          domain={
            reversed
              ? [(min: number) => Math.max(1, Math.floor(min - 2)), (max: number) => Math.ceil(max + 2)]
              : [0, "auto"]
          }
          allowDecimals={format !== "position"}
          tickFormatter={(v: number) => formatValue(v, format)}
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border)" }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const d = payload?.[0]?.payload?.date;
                return typeof d === "string" ? formatDate(d, "long") : "";
              }}
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-[2px]" style={{ background: `var(--color-${name})` }} />
                    <span className="text-muted-foreground">{config[name as string]?.label}</span>
                  </span>
                  <span className="text-foreground font-mono font-medium tabular-nums">{formatValue(value, format)}</span>
                </div>
              )}
            />
          }
        />
        {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            type="monotone"
            stroke={`var(--color-${s.key})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
