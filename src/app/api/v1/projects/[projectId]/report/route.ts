import { NextResponse } from "next/server";
import { apiError, searchParamsOf, withApiAuth } from "@/lib/api";
import { getProjectReport } from "@/lib/queries";
import { apiRangeSchema } from "@/lib/validations";

/** Overview report: totals, daily series (GSC + GA4 + rankings), top movers. */
export const GET = withApiAuth<{ projectId: string }>(async ({ request, project }) => {
  const parsed = apiRangeSchema.safeParse(searchParamsOf(request));
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  const report = await getProjectReport(project!.id, parsed.data.days);
  return NextResponse.json({ data: report });
});
