/** Anchor text frequency as labelled bars. Shared by the backlinks page and the printable report. */
export function TopAnchors({ anchors }: { anchors: { anchor: string; count: number }[] }) {
  if (anchors.length === 0) return <p className="text-muted-foreground text-sm">No backlinks yet.</p>;
  const max = anchors[0].count;
  return (
    <ul className="flex flex-col gap-2">
      {anchors.map(({ anchor, count }) => (
        <li key={anchor} className="flex items-center gap-3 text-sm">
          <span className="min-w-0 flex-1 truncate">{anchor}</span>
          <span className="bg-muted relative h-1.5 w-20 overflow-hidden rounded-full print:border">
            <span className="bg-chart-1 absolute inset-y-0 left-0 rounded-full" style={{ width: `${(count / max) * 100}%` }} />
          </span>
          <span className="text-muted-foreground w-6 text-right tabular-nums">{count}</span>
        </li>
      ))}
    </ul>
  );
}
