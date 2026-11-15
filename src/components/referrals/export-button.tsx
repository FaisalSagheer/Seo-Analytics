"use client";

import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";
import type { ReferralSite } from "@/lib/referrals";

/** Saves the sites list as shown on the page: the selected range, busiest first. */
export function ReferralsExport({ domain, days, sites }: { domain: string; days: number; sites: ReferralSite[] }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const csv = toCsv(
          ["Site", "Sessions", "Users", "Conversions", "Previous sessions", "Change", "First seen", "New"],
          sites.map((s) => [s.source, s.sessions, s.users, s.conversions, s.previous, s.previous != null ? s.sessions - s.previous : null, s.firstSeen, s.isNew ? "yes" : "no"]),
        );
        downloadCsv(`referrals-${domain}-${days}d-${new Date().toISOString().slice(0, 10)}.csv`, csv);
        toast.success(`Exported ${sites.length} site${sites.length === 1 ? "" : "s"}`);
      }}
    >
      <DownloadIcon data-icon="inline-start" />
      Export CSV
    </Button>
  );
}
