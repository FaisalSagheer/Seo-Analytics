import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api";
import { getBacklinkReport } from "@/lib/backlinks";

/** Backlinks from the Search Console Links exports uploaded for this project, with new and lost sites between the last two. */
export const GET = withApiAuth<{ projectId: string }>(async ({ project }) => {
  return NextResponse.json({ data: await getBacklinkReport(project!.id) });
});
