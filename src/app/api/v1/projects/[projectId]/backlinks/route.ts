import { NextResponse } from "next/server";
import { apiError, searchParamsOf, withApiAuth } from "@/lib/api";
import { BACKLINK_VIEWS, getViewSources, parseBacklinkView } from "@/lib/backlinks";
import { db } from "@/lib/db";

/** Stored backlinks. ?source=dataforseo|bing narrows to one source; omitted returns all, each row tagged. */
export const GET = withApiAuth<{ projectId: string }>(async ({ request, project }) => {
  const raw = searchParamsOf(request).source;
  const view = parseBacklinkView(raw);
  if (raw && !view) return apiError(400, `source must be one of: ${BACKLINK_VIEWS.join(", ")}`);
  const links = await db.backlink.findMany({
    where: { projectId: project!.id, ...(view ? { source: { in: getViewSources(view) } } : {}) },
    orderBy: [{ domainFromRank: "desc" }, { domainFrom: "asc" }],
  });
  return NextResponse.json({
    data: links.map((l) => ({
      source: l.source.toLowerCase(),
      urlFrom: l.urlFrom,
      urlTo: l.urlTo,
      domainFrom: l.domainFrom,
      anchor: l.anchor,
      dofollow: l.dofollow,
      domainFromRank: l.domainFromRank,
      firstSeen: l.firstSeen,
      lastSeen: l.lastSeen,
      isNew: l.isNew,
      isLost: l.isLost,
    })),
    meta: { count: links.length, source: view ?? "all" },
  });
});
