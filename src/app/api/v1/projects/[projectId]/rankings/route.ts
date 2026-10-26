import { NextResponse } from "next/server";
import { apiError, searchParamsOf, withApiAuth } from "@/lib/api";
import { getRankingRows } from "@/lib/queries";
import { apiRankingsQuerySchema } from "@/lib/validations";

/** Ranking history per keyword. Filter with ?keyword= (substring) and ?tag=. */
export const GET = withApiAuth<{ projectId: string }>(async ({ request, project }) => {
  const parsed = apiRankingsQuerySchema.safeParse(searchParamsOf(request));
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  const { days, keyword, tag } = parsed.data;
  const rows = (await getRankingRows(project!.id, days)).filter(
    (r) => (!keyword || r.phrase.includes(keyword.toLowerCase())) && (!tag || r.tags.includes(tag.toLowerCase())),
  );
  return NextResponse.json({ data: rows, meta: { days, count: rows.length } });
});
