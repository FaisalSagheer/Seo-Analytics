// ---- SEO provider contract ----

export type Market = {
  locationCode: number;
  languageCode: string;
};

export type RankCheckInput = Market & {
  keyword: string;
  domain: string;
  device: "desktop" | "mobile";
};

export type RankCheckResult = {
  /** null when the domain is not in the checked depth */
  position: number | null;
  url: string | null;
};

export type SearchIntent = "informational" | "navigational" | "commercial" | "transactional" | "unknown";

export type KeywordIdea = {
  keyword: string;
  searchVolume: number;
  cpc: number;
  competition: number;
  difficulty: number;
  intent: SearchIntent;
};

export type DomainMetrics = {
  organicKeywords: number;
  organicTraffic: number;
  trafficCost: number;
  pos1: number;
  pos2to3: number;
  pos4to10: number;
};

export type TopPageRow = {
  url: string;
  traffic: number;
  keywords: number;
  pos1: number;
};

export type BacklinkSummary = {
  backlinks: number;
  referringDomains: number;
  domainRank: number;
  brokenBacklinks: number;
  referringIps: number;
  nofollowDomains: number;
};

export type BacklinkRow = {
  urlFrom: string;
  urlTo: string;
  domainFrom: string;
  anchor: string;
  dofollow: boolean;
  domainFromRank: number;
  firstSeen: Date;
  lastSeen: Date;
  isNew: boolean;
  isLost: boolean;
};

export interface SeoProvider {
  readonly name: "dataforseo" | "demo";
  checkRank(input: RankCheckInput): Promise<RankCheckResult>;
  keywordIdeas(input: Market & { seeds: string[]; limit: number }): Promise<KeywordIdea[]>;
  domainOverview(input: Market & { domain: string }): Promise<DomainMetrics>;
  topPages(input: Market & { domain: string; limit: number }): Promise<TopPageRow[]>;
  backlinkSummary(input: { domain: string }): Promise<BacklinkSummary>;
  backlinks(input: { domain: string; limit: number }): Promise<BacklinkRow[]>;
}

// ---- Google data ----

export type GscDailyRow = { date: string; clicks: number; impressions: number; ctr: number; position: number };
export type GscQueryRow = { query: string; clicks: number; impressions: number; ctr: number; position: number };
export type Ga4DailyRow = { date: string; sessions: number; users: number; conversions: number; engagementRate: number };

// ---- Report shapes (UI + public API) ----

export type RankingRow = {
  keywordId: string;
  phrase: string;
  tags: string[];
  searchVolume: number | null;
  position: number | null;
  previous: number | null;
  /** positive = improved */
  change: number | null;
  best: number | null;
  url: string | null;
  history: { date: string; position: number | null }[];
};

export type OverviewPoint = {
  date: string;
  clicks: number | null;
  impressions: number | null;
  sessions: number | null;
  conversions: number | null;
  avgPosition: number | null;
  visibility: number | null;
};

export type ProjectReport = {
  project: { id: string; name: string; domain: string; isDemo: boolean };
  range: { from: string; to: string; days: number };
  totals: {
    trackedKeywords: number;
    avgPosition: number | null;
    visibility: number | null;
    visibilityChange: number | null;
    top3: number;
    top10: number;
    clicks: number;
    impressions: number;
    sessions: number;
    conversions: number;
  };
  series: OverviewPoint[];
  movers: { up: RankingRow[]; down: RankingRow[] };
};
