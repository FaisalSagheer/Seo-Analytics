import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api";
import { listProjectsFor } from "@/lib/roles";

export const GET = withApiAuth(async ({ userId, role }) => {
  const projects = await listProjectsFor(role, userId);
  return NextResponse.json({
    data: projects.map((p) => ({
      id: p.id,
      name: p.name,
      domain: p.domain,
      locationCode: p.locationCode,
      languageCode: p.languageCode,
      device: p.device.toLowerCase(),
      isDemo: p.isDemo,
      keywordCount: p._count.keywords,
      gscSiteUrl: p.gscSiteUrl,
      ga4PropertyId: p.ga4PropertyId,
      lastSyncedAt: p.lastSyncedAt,
      createdAt: p.createdAt,
    })),
  });
});
