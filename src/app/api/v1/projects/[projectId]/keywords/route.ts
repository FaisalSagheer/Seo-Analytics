import { NextResponse } from "next/server";
import { apiError, withApiAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { apiAddKeywordsSchema } from "@/lib/validations";

export const GET = withApiAuth<{ projectId: string }>(async ({ project }) => {
  const keywords = await db.keyword.findMany({ where: { projectId: project!.id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({
    data: keywords.map((k) => ({
      id: k.id,
      phrase: k.phrase,
      tags: k.tags ? k.tags.split(",") : [],
      searchVolume: k.searchVolume,
      createdAt: k.createdAt,
    })),
  });
});

/** Body: { "keywords": ["..."], "tags": ["..."] }. Duplicates are skipped. Checked on the next sync. */
export const POST = withApiAuth<{ projectId: string }>(async ({ request, project }) => {
  const body = await request.json().catch(() => null);
  const parsed = apiAddKeywordsSchema.safeParse(body);
  if (!parsed.success) return apiError(400, parsed.error.issues[0].message);
  const tags = parsed.data.tags.map((t) => t.toLowerCase()).join(",");
  const { count } = await db.keyword.createMany({
    data: [...new Set(parsed.data.keywords.map((k) => k.toLowerCase()))].map((phrase) => ({ projectId: project!.id, phrase, tags })),
    skipDuplicates: true,
  });
  return NextResponse.json({ data: { added: count } }, { status: 201 });
});
