import type { BacklinkView } from "@/lib/types";

/** Plain helpers shared by server pages, the client table and the CSV export. */

export const BACKLINK_VIEWS = ["dataforseo", "bing"] as const;
export type BacklinkViewKey = (typeof BACKLINK_VIEWS)[number];

/** Which stored sources a view shows. Demo data stands in for DataForSEO. */
export function getViewSources(view: BacklinkViewKey): BacklinkView["source"][] {
  switch (view) {
    case "bing":
      return ["BING"];
    case "dataforseo":
    default:
      return ["DATAFORSEO", "DEMO"];
  }
}

export function getViewLabel(view: BacklinkViewKey) {
  switch (view) {
    case "bing":
      return "Bing";
    case "dataforseo":
    default:
      return "DataForSEO";
  }
}

export function parseBacklinkView(value: string | string[] | undefined): BacklinkViewKey | null {
  const v = Array.isArray(value) ? value[0] : value;
  return (BACKLINK_VIEWS as readonly string[]).includes(v ?? "") ? (v as BacklinkViewKey) : null;
}

export function getBacklinkStatus(b: Pick<BacklinkView, "isNew" | "isLost">) {
  if (b.isLost) return { label: "Lost", variant: "destructive" as const };
  if (b.isNew) return { label: "New", variant: "secondary" as const };
  return { label: "Live", variant: "outline" as const };
}

export function getLinkTypeLabel(dofollow: boolean | null) {
  if (dofollow == null) return "Unknown";
  return dofollow ? "Dofollow" : "Nofollow";
}

export function getSourceLabel(source: BacklinkView["source"]) {
  switch (source) {
    case "DATAFORSEO":
      return "DataForSEO";
    case "BING":
      return "Bing Webmaster Tools";
    case "DEMO":
      return "Demo data";
    default:
      return source;
  }
}
