"use client";

import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";

export type AuditExportRow = {
  url: string;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  wordCount: number | null;
  loadMs: number | null;
  internalLinks: number | null;
  externalLinks: number | null;
  canonical: string | null;
  errors: string[];
  warnings: string[];
  notices: string[];
};

/** Saves the latest audit as a CSV: one row per crawled page, plus one for site-wide issues. */
export function AuditExportButton({ domain, date, rows }: { domain: string; date: string; rows: AuditExportRow[] }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const csv = toCsv(
          ["URL", "Status", "Title", "Meta description", "H1", "Words", "Load (ms)", "Internal links", "External links", "Canonical", "Errors", "Warnings", "Notices"],
          rows.map((r) => [
            r.url,
            r.statusCode,
            r.title,
            r.metaDescription,
            r.h1,
            r.wordCount,
            r.loadMs,
            r.internalLinks,
            r.externalLinks,
            r.canonical,
            r.errors.join("; "),
            r.warnings.join("; "),
            r.notices.join("; "),
          ]),
        );
        downloadCsv(`site-audit-${domain}-${date}.csv`, csv);
        const pages = rows.filter((r) => r.statusCode != null).length;
        toast.success(`Exported ${pages} page${pages === 1 ? "" : "s"}`);
      }}
    >
      <DownloadIcon data-icon="inline-start" />
      Export CSV
    </Button>
  );
}
