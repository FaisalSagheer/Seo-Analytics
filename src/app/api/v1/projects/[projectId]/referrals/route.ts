import { NextResponse } from "next/server";
import { apiError, searchParamsOf, withApiAuth } from "@/lib/api";
import { getReferralReport } from "@/lib/referrals";
import { apiRangeSchema } from "@/lib/validations";

/** Sites and pages that sent visitors, from GA4's Referral channel. Partial by nature: unclicked links don't appear. */
export const GET = withApiAuth<{ projectId: string }>(async ({ request, project }) => {
  const parsed = apiRangeSchema.safeParse(searchParamsOf(request));
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  const report = await getReferralReport(project!.id, parsed.data.days);
  return NextResponse.json({ data: report });
});
