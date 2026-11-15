import { rng } from "@/lib/demo/random";

/** Day number so ranks drift day by day but stay stable within a day. */
export function dayIndex(d = new Date()) {
  return Math.floor(d.getTime() / 86_400_000);
}

/**
 * A keyword's demo position on a given day: a stable base rank plus a slow
 * trend and some noise. Used by the demo project's seed and its refresh.
 */
export function demoPosition(keyword: string, day: number): number | null {
  const r = rng(`base:${keyword}`);
  const base = r.int(4, 55);
  // A slow wave (months) for the trend and a faster one (weeks) for churn,
  // so the history is smooth and bounded rather than a random walk.
  const slow = r.float(4, 14) * Math.sin(day / r.float(40, 90) + r.float(0, 6.28));
  const fast = r.float(1, 4) * Math.sin(day / r.float(5, 12) + r.float(0, 6.28));
  const noise = rng(`d:${keyword}:${day}`).float(-1.5, 1.5);
  const pos = Math.round(base + slow + fast + noise);
  if (pos > 100) return null;
  return Math.max(1, pos);
}

export function demoVolume(keyword: string) {
  const r = rng(`vol:${keyword}`);
  return Math.round(Math.pow(10, r.float(1.6, 4.6)) / 10) * 10;
}
