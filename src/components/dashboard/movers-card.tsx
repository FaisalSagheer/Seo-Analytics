import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Delta } from "@/components/dashboard/delta";
import { formatPosition } from "@/lib/format";
import type { RankingRow } from "@/lib/types";

export function MoversCard({
  title,
  description,
  rows,
  projectId,
}: {
  title: string;
  description: string;
  rows: RankingRow[];
  projectId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No movement in this range.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {rows.map((r) => (
              <li key={r.keywordId} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <Link
                  href={`/projects/${projectId}/rankings/${r.keywordId}`}
                  className="min-w-0 flex-1 truncate text-sm hover:underline"
                >
                  {r.phrase}
                </Link>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {formatPosition(r.previous)} → {formatPosition(r.position)}
                </span>
                <Delta value={r.change} className="w-12 justify-end" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
