import "server-only";
import type {
  BacklinkRow,
  BacklinkSummary,
  DomainMetrics,
  KeywordIdea,
  SearchIntent,
  SeoProvider,
  TopPageRow,
} from "@/lib/types";

const BASE = "https://api.dataforseo.com/v3";
const TIMEOUT_MS = 60_000;

export class DataForSeoError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
  ) {
    super(message);
    this.name = "DataForSeoError";
  }
}

type Envelope<T> = {
  status_code: number;
  status_message: string;
  tasks?: { status_code: number; status_message: string; result: T[] | null }[];
};

/** Strip protocol, www. and path: DataForSEO wants a bare domain. */
export function bareDomain(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function createDataForSeo(login: string, password: string): SeoProvider {
  const auth = `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;

  async function post<T>(path: string, task: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        // Live endpoints take an array holding exactly one task
        body: JSON.stringify([task]),
        signal: controller.signal,
        cache: "no-store",
      });
      if (res.status === 401) throw new DataForSeoError("DataForSEO rejected the login or password", 401);
      const json = (await res.json()) as Envelope<T>;
      if (json.status_code !== 20000) throw new DataForSeoError(json.status_message, json.status_code);
      const t = json.tasks?.[0];
      if (!t || t.status_code !== 20000) throw new DataForSeoError(t?.status_message ?? "Empty task", t?.status_code);
      const result = t.result?.[0];
      if (!result) throw new DataForSeoError("No result returned");
      return result;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    name: "dataforseo",

    async checkRank({ keyword, domain, locationCode, languageCode, device }) {
      type R = { items?: { type: string; rank_group: number; domain?: string; url?: string }[] };
      const r = await post<R>("/serp/google/organic/live/advanced", {
        keyword,
        location_code: locationCode,
        language_code: languageCode,
        device,
        depth: 100,
      });
      const target = bareDomain(domain);
      const hit = r.items?.find(
        (i) => i.type === "organic" && i.domain && (bareDomain(i.domain) === target || bareDomain(i.domain).endsWith(`.${target}`)),
      );
      return { position: hit?.rank_group ?? null, url: hit?.url ?? null };
    },

    async keywordIdeas({ seeds, locationCode, languageCode, limit }) {
      type R = {
        items?: {
          keyword: string;
          keyword_info?: { search_volume?: number | null; cpc?: number | null; competition?: number | null };
          keyword_properties?: { keyword_difficulty?: number | null };
          search_intent_info?: { main_intent?: string | null } | null;
        }[];
      };
      const r = await post<R>("/dataforseo_labs/google/keyword_ideas/live", {
        keywords: seeds,
        location_code: locationCode,
        language_code: languageCode,
        limit,
        order_by: ["keyword_info.search_volume,desc"],
      });
      return (r.items ?? []).map<KeywordIdea>((i) => ({
        keyword: i.keyword,
        searchVolume: i.keyword_info?.search_volume ?? 0,
        cpc: i.keyword_info?.cpc ?? 0,
        competition: i.keyword_info?.competition ?? 0,
        difficulty: i.keyword_properties?.keyword_difficulty ?? 0,
        intent: toIntent(i.search_intent_info?.main_intent),
      }));
    },

    async domainOverview({ domain, locationCode, languageCode }) {
      type Organic = {
        count?: number;
        etv?: number;
        estimated_paid_traffic_cost?: number;
        pos_1?: number;
        pos_2_3?: number;
        pos_4_10?: number;
      };
      type R = { items?: { metrics?: { organic?: Organic } }[] };
      const r = await post<R>("/dataforseo_labs/google/domain_rank_overview/live", {
        target: bareDomain(domain),
        location_code: locationCode,
        language_code: languageCode,
      });
      const o = r.items?.[0]?.metrics?.organic ?? {};
      return {
        organicKeywords: o.count ?? 0,
        organicTraffic: o.etv ?? 0,
        trafficCost: o.estimated_paid_traffic_cost ?? 0,
        pos1: o.pos_1 ?? 0,
        pos2to3: o.pos_2_3 ?? 0,
        pos4to10: o.pos_4_10 ?? 0,
      } satisfies DomainMetrics;
    },

    async topPages({ domain, locationCode, languageCode, limit }) {
      type R = {
        items?: { page_address: string; metrics?: { organic?: { etv?: number; count?: number; pos_1?: number } } }[];
      };
      const r = await post<R>("/dataforseo_labs/google/relevant_pages/live", {
        target: bareDomain(domain),
        location_code: locationCode,
        language_code: languageCode,
        item_types: ["organic"],
        order_by: ["metrics.organic.etv,desc"],
        limit,
      });
      return (r.items ?? []).map<TopPageRow>((i) => ({
        url: i.page_address,
        traffic: i.metrics?.organic?.etv ?? 0,
        keywords: i.metrics?.organic?.count ?? 0,
        pos1: i.metrics?.organic?.pos_1 ?? 0,
      }));
    },

    async backlinkSummary({ domain }) {
      type R = {
        backlinks?: number;
        referring_domains?: number;
        rank?: number;
        broken_backlinks?: number;
        referring_ips?: number;
        referring_domains_nofollow?: number;
      };
      const r = await post<R>("/backlinks/summary/live", {
        target: bareDomain(domain),
        rank_scale: "one_hundred",
      });
      return {
        backlinks: r.backlinks ?? 0,
        referringDomains: r.referring_domains ?? 0,
        domainRank: r.rank ?? 0,
        brokenBacklinks: r.broken_backlinks ?? 0,
        referringIps: r.referring_ips ?? 0,
        nofollowDomains: r.referring_domains_nofollow ?? 0,
      } satisfies BacklinkSummary;
    },

    async backlinks({ domain, limit }) {
      type R = {
        items?: {
          url_from: string;
          url_to: string;
          domain_from: string;
          anchor: string | null;
          dofollow: boolean;
          domain_from_rank: number;
          first_seen: string;
          last_seen: string;
          is_new: boolean;
          is_lost: boolean;
        }[];
      };
      const r = await post<R>("/backlinks/backlinks/live", {
        target: bareDomain(domain),
        mode: "as_is",
        backlinks_status_type: "all",
        order_by: ["domain_from_rank,desc"],
        rank_scale: "one_hundred",
        limit,
      });
      return (r.items ?? []).map<BacklinkRow>((i) => ({
        urlFrom: i.url_from,
        urlTo: i.url_to,
        domainFrom: i.domain_from,
        anchor: i.anchor ?? "",
        dofollow: i.dofollow,
        domainFromRank: i.domain_from_rank,
        firstSeen: new Date(i.first_seen),
        lastSeen: new Date(i.last_seen),
        isNew: i.is_new,
        isLost: i.is_lost,
      }));
    },
  };
}

function toIntent(v: string | null | undefined): SearchIntent {
  switch (v) {
    case "informational":
    case "navigational":
    case "commercial":
    case "transactional":
      return v;
    default:
      return "unknown";
  }
}
