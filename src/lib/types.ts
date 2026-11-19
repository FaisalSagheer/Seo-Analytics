export type RankCheckResult = {
  /** null when the domain is not in the checked depth */
  position: number | null;
  url: string | null;
};

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
  /** The page that ranked before the current one, when it changed within the range */
  previousUrl: string | null;
  /** Pages that each got at least COMPETING_SHARE of the keyword's impressions in the range */
  competingPages: number;
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
