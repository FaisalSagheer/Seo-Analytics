import { NextResponse } from "next/server";
import { apiError, searchParamsOf, withApiAuth } from "@/lib/api";
import { getDomainData } from "@/lib/queries";
import { toDateKey } from "@/lib/dates";
import { apiRangeSchema } from "@/lib/validations";

/** Domain snapshots (organic keywords, traffic, backlinks over time) and current top pages. */
export const GET = withApiAuth<{ projectId: string }>(async ({ request, project }) => {
  const parsed = apiRangeSchema.extend({ days: apiRangeSchema.shape.days.default(180) }).safeParse(searchParamsOf(request));
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  const { snapshots, pages } = await getDomainData(project!.id, parsed.data.days);
  return NextResponse.json({
    data: {
      snapshots: snapshots.map((s) => ({
        date: toDateKey(s.capturedAt),
        organicKeywords: s.organicKeywords,
        organicTraffic: s.organicTraffic,
        trafficCost: s.trafficCost,
        pos1: s.pos1,
        pos2to3: s.pos2to3,
        pos4to10: s.pos4to10,
        backlinks: s.backlinks,
        referringDomains: s.referringDomains,
        domainRank: s.domainRank,
      })),
      topPages: pages.map((p) => ({ url: p.url, traffic: p.traffic, keywords: p.keywords, pos1: p.pos1 })),
    },
  });
});
