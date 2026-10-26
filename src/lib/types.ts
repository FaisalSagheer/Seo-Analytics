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

/** null = the source doesn't report it (Bing gives only URL + anchor) */
export type BacklinkRow = {
  urlFrom: string;
  urlTo: string;
  domainFrom: string;
  anchor: string;
  dofollow: boolean | null;
  domainFromRank: number | null;
  firstSeen: Date | null;
  lastSeen: Date | null;
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

/** A stored backlink, serialisable for client components and CSV */
export type BacklinkView = {
  id: string;
  urlFrom: string;
  urlTo: string;
  domainFrom: string;
  anchor: string;
  dofollow: boolean | null;
  domainFromRank: number | null;
  firstSeen: string | null;
  lastSeen: string | null;
  isNew: boolean;
  isLost: boolean;
  source: "DATAFORSEO" | "SERPER" | "BING" | "DEMO";
};

export type BacklinkReport = {
  project: { id: string; name: string; domain: string; isDemo: boolean };
  generatedAt: string;
  days: number;
  /** The source view this report shows */
  view: "dataforseo" | "bing";
  /** Views that have any stored data for this project */
  availableViews: ("dataforseo" | "bing")[];
  sources: BacklinkView["source"][];
  summary: {
    referringDomains: number | null;
    referringDomainsChange: number | null;
    backlinks: number | null;
    domainRank: number | null;
    /** Share of links with a known type that are dofollow; null when no link reports it */
    dofollowShare: number | null;
    newCount: number;
    lostCount: number;
    sampleSize: number;
  };
  history: { date: string; referringDomains: number | null }[];
  anchors: { anchor: string; count: number }[];
  topDomains: { domain: string; links: number; rank: number | null }[];
  links: BacklinkView[];
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
