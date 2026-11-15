import "server-only";
import { db } from "@/lib/db";
import { dateKeys, daysAgo, toDateKey, utcDay } from "@/lib/dates";

/** How many days of referral history each sync stores. */
export const REFERRAL_WINDOW_DAYS = 180;

export type ReferralSite = {
  source: string;
  sessions: number;
  users: number;
  conversions: number;
  /** Sessions in the previous period of the same length; null when that period isn't stored */
  previous: number | null;
  /** First day this site sent a visit in the stored history */
  firstSeen: string;
  /** First seen inside this range, so it's a new link source */
  isNew: boolean;
};

export type ReferralReport = {
  range: { from: string; to: string; days: number };
  /** The previous period is only compared when the stored history reaches back far enough */
  comparable: boolean;
  totals: {
    sessions: number;
    previousSessions: number | null;
    sites: number;
    newSites: number;
    goneSites: number;
    conversions: number;
  };
  series: { date: string; sessions: number }[];
  sites: ReferralSite[];
  /** Sent visits in the previous period but none in this one */
  gone: { source: string; previous: number }[];
  pages: { referrer: string; source: string; sessions: number; users: number }[];
  hasData: boolean;
};

/**
 * Who sent visitors to the project, from GA4's referral channel. This is not a full backlink
 * list: a link nobody clicked is invisible here. It does show real, working links, and which
 * ones appeared or stopped compared with the period before.
 */
export async function getReferralReport(projectId: string, days: number): Promise<ReferralReport> {
  const to = utcDay();
  const from = daysAgo(days - 1);
  const comparable = days * 2 <= REFERRAL_WINDOW_DAYS;
  const prevFrom = daysAgo(days * 2 - 1);

  const [rows, firsts, pages] = await Promise.all([
    db.referralDaily.findMany({ where: { projectId, date: { gte: comparable ? prevFrom : from } } }),
    db.referralDaily.groupBy({ by: ["source"], where: { projectId }, _min: { date: true } }),
    db.referralPage.findMany({ where: { projectId }, orderBy: { sessions: "desc" }, take: 100 }),
  ]);
  const firstSeen = new Map(firsts.map((f) => [f.source, f._min.date ? toDateKey(f._min.date) : toDateKey(from)]));
  const fromKey = toDateKey(from);

  const current = new Map<string, { sessions: number; users: number; conversions: number }>();
  const previous = new Map<string, number>();
  const perDay = new Map<string, number>();
  for (const r of rows) {
    const key = toDateKey(r.date);
    if (key >= fromKey) {
      const c = current.get(r.source) ?? { sessions: 0, users: 0, conversions: 0 };
      c.sessions += r.sessions;
      c.users += r.users;
      c.conversions += r.conversions;
      current.set(r.source, c);
      perDay.set(key, (perDay.get(key) ?? 0) + r.sessions);
    } else {
      previous.set(r.source, (previous.get(r.source) ?? 0) + r.sessions);
    }
  }

  const sites: ReferralSite[] = [...current].map(([source, c]) => {
    const first = firstSeen.get(source) ?? fromKey;
    return {
      source,
      ...c,
      previous: comparable ? (previous.get(source) ?? 0) : null,
      firstSeen: first,
      isNew: first >= fromKey,
    };
  });
  sites.sort((a, b) => b.sessions - a.sessions || a.source.localeCompare(b.source));

  const gone = comparable
    ? [...previous].filter(([source]) => !current.has(source)).map(([source, p]) => ({ source, previous: p })).sort((a, b) => b.previous - a.previous)
    : [];
  const sessions = sites.reduce((s, x) => s + x.sessions, 0);

  return {
    range: { from: fromKey, to: toDateKey(to), days },
    comparable,
    totals: {
      sessions,
      previousSessions: comparable ? [...previous.values()].reduce((s, n) => s + n, 0) : null,
      sites: sites.length,
      newSites: sites.filter((s) => s.isNew).length,
      goneSites: gone.length,
      conversions: sites.reduce((s, x) => s + x.conversions, 0),
    },
    series: dateKeys(from, to).map((date) => ({ date, sessions: perDay.get(date) ?? 0 })),
    sites,
    gone,
    pages: pages.map((p) => ({ referrer: p.referrer, source: p.source, sessions: p.sessions, users: p.users })),
    hasData: firsts.length > 0 || pages.length > 0,
  };
}
