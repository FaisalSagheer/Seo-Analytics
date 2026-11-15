"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { denied, requireProject, requireUser } from "@/lib/session";
import { KIND_LABEL, parseLinkFiles, type LinkKind } from "@/lib/links/gsc-links";
import { fail, ok, type ActionResult } from "@/lib/actions/result";

const MAX_FILES = 8;
const MAX_FILE_BYTES = 1_000_000;
/** Older uploads are dropped so a project's history can't grow without limit. */
const KEEP_IMPORTS = 24;

export type ImportSummary = { importId: string; imported: { kind: LinkKind; label: string; rows: number }[]; skipped: { fileName: string; reason: string }[] };

/** Stores one upload of Search Console's Links report: its ZIP, or the CSVs from it. */
export async function importLinks(formData: FormData): Promise<ActionResult<ImportSummary>> {
  const blocked = await denied("data.sync");
  if (blocked) return blocked;
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return fail("Missing project.");
  const { project } = await requireProject(projectId);
  const me = await requireUser();

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const asOfKey = String(formData.get("asOf") || todayKey);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOfKey) || Number.isNaN(Date.parse(asOfKey))) return fail("Enter the export date as a valid date.");
  if (asOfKey > todayKey) return fail("The export date can't be in the future.");

  const entries = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (entries.length === 0) return fail("Choose the ZIP or CSV files exported from Search Console.");
  if (entries.length > MAX_FILES) return fail(`Choose at most ${MAX_FILES} files at once.`);
  for (const f of entries) if (f.size > MAX_FILE_BYTES) return fail(`${f.name} is larger than 1 MB, so it isn't a Links export.`);

  const files = await Promise.all(entries.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })));
  const { tables, skipped } = parseLinkFiles(files);
  if (tables.length === 0) {
    return fail(`Nothing could be imported. ${skipped.map((s) => `${s.fileName}: ${s.reason}`).join(" ")}`.trim());
  }

  const created = await db.$transaction(async (tx) => {
    const imp = await tx.linkImport.create({ data: { projectId: project.id, asOf: new Date(`${asOfKey}T00:00:00Z`), createdById: me.id } });
    for (const t of tables) {
      await tx.linkImportRow.createMany({ data: t.rows.map((r) => ({ importId: imp.id, kind: t.kind, label: r.label, links: r.links, related: r.related })) });
    }
    const old = await tx.linkImport.findMany({
      where: { projectId: project.id },
      orderBy: [{ asOf: "desc" }, { createdAt: "desc" }],
      skip: KEEP_IMPORTS,
      select: { id: true },
    });
    if (old.length) await tx.linkImport.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    return imp;
  });

  revalidatePath(`/projects/${project.id}`, "layout");
  return ok({
    importId: created.id,
    imported: tables.map((t) => ({ kind: t.kind, label: KIND_LABEL[t.kind], rows: t.rows.length })),
    skipped,
  });
}

export async function deleteLinkImport(projectId: string, importId: string): Promise<ActionResult> {
  const blocked = await denied("data.sync");
  if (blocked) return blocked;
  const { project } = await requireProject(projectId);
  await db.linkImport.deleteMany({ where: { id: importId, projectId: project.id } });
  revalidatePath(`/projects/${project.id}`, "layout");
  return ok(undefined);
}
