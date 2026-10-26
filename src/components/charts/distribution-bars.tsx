"use client";

import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatNumber } from "@/lib/format";

const config = { count: { label: "Keywords", color: "var(--chart-1)" } } satisfies ChartConfig;

/** Keyword counts per position band. One magnitude, one hue. */
export function DistributionBars({ data }: { data: { band: string; count: number }[] }) {
  return (
    <ChartContainer config={config} className="h-56 w-full">
      <BarChart data={data} margin={{ top: 20, left: 4, right: 4 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="band" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis hide />
        <ChartTooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent hideIndicator />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={56} isAnimationActive={false}>
          <LabelList dataKey="count" position="top" className="fill-muted-foreground" fontSize={12} formatter={(v: unknown) => formatNumber(Number(v))} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
