/** Minimal robots.txt reader: the rules for `User-agent: *` plus Sitemap lines. */
export type RobotsRules = {
  rules: { allow: boolean; pattern: RegExp; length: number }[];
  sitemaps: string[];
  blocksAll: boolean;
};

function toRegex(path: string) {
  const escaped = path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped.endsWith("\\$") ? `${escaped.slice(0, -2)}$` : escaped}`);
}

export function parseRobots(text: string): RobotsRules {
  const rules: RobotsRules["rules"] = [];
  const sitemaps: string[] = [];
  let groupAgents: string[] = [];
  let inRules = false;
  let blocksAll = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === "sitemap") {
      if (value) sitemaps.push(value);
    } else if (field === "user-agent") {
      if (inRules) {
        groupAgents = [];
        inRules = false;
      }
      groupAgents.push(value.toLowerCase());
    } else if ((field === "disallow" || field === "allow") && groupAgents.includes("*")) {
      inRules = true;
      if (!value) continue; // "Disallow:" with no path allows everything
      if (field === "disallow" && value === "/") blocksAll = true;
      rules.push({ allow: field === "allow", pattern: toRegex(value), length: value.length });
    } else if (field === "disallow" || field === "allow") {
      inRules = true;
    }
  }
  return { rules, sitemaps, blocksAll };
}

/** Longest matching rule wins; Allow wins a tie. No matching rule means allowed. */
export function isAllowed(robots: RobotsRules, pathAndQuery: string) {
  let best: { allow: boolean; length: number } | null = null;
  for (const r of robots.rules) {
    if (!r.pattern.test(pathAndQuery)) continue;
    if (!best || r.length > best.length || (r.length === best.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}
