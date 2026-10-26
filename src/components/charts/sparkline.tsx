/**
 * Tiny inline rank trend for table rows. Pure SVG (no Recharts) so a table of
 * hundreds of keywords stays cheap. Lower position = higher on the line.
 */
export function Sparkline({
  points,
  width = 96,
  height = 28,
}: {
  points: (number | null)[];
  width?: number;
  height?: number;
}) {
  const ranked = points.filter((p): p is number => p != null);
  if (ranked.length < 2) return <span className="text-muted-foreground text-xs">—</span>;

  const min = Math.min(...ranked);
  const max = Math.max(...ranked);
  const span = Math.max(1, max - min);
  const step = width / Math.max(1, points.length - 1);
  const y = (p: number) => 2 + ((p - min) / span) * (height - 4);

  let d = "";
  points.forEach((p, i) => {
    if (p == null) return;
    d += `${d && points[i - 1] != null ? "L" : "M"}${(i * step).toFixed(1)},${y(p).toFixed(1)}`;
  });
  const last = ranked.at(-1)!;
  const first = ranked[0];
  const color = last < first ? "var(--success)" : last > first ? "var(--danger)" : "var(--muted-foreground)";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Trend from ${first} to ${last}`}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
