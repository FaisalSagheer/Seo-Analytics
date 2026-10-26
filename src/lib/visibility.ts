/**
 * Expected click-through rate by organic position. Used to turn a set of
 * rankings into one "visibility" number: the share of clicks the domain would
 * capture if it held position 1 for every tracked keyword.
 */
const CTR = [0.28, 0.15, 0.11, 0.08, 0.06, 0.045, 0.035, 0.03, 0.025, 0.02];
const MAX = CTR[0];

export function expectedCtr(position: number | null): number {
  if (position == null || position < 1) return 0;
  if (position <= 10) return CTR[position - 1];
  if (position <= 20) return 0.01;
  if (position <= 30) return 0.003;
  return 0;
}

const DEFAULT_VOLUME = 100;

/** 0–100. Keywords without a known volume count as DEFAULT_VOLUME. */
export function visibilityScore(rows: { position: number | null; volume: number | null }[]): number | null {
  if (rows.length === 0) return null;
  let got = 0;
  let max = 0;
  for (const r of rows) {
    const v = r.volume ?? DEFAULT_VOLUME;
    got += expectedCtr(r.position) * v;
    max += MAX * v;
  }
  return max === 0 ? null : (got / max) * 100;
}

/** Mean of ranked positions only; unranked keywords are excluded. */
export function averagePosition(positions: (number | null)[]): number | null {
  const ranked = positions.filter((p): p is number => p != null);
  if (ranked.length === 0) return null;
  return ranked.reduce((a, b) => a + b, 0) / ranked.length;
}
