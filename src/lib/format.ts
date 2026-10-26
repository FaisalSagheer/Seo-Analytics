const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const currency = new Intl.NumberFormat("en", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const currencyCompact = new Intl.NumberFormat("en", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** 1234 → "1,234"; 12345 → "12.3K". Below 10K stays exact so small numbers don't lose precision. */
export function formatNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Math.abs(n) >= 10_000 ? compact.format(n) : whole.format(n);
}

export function formatCurrency(n: number | null | undefined, opts?: { compact?: boolean }): string {
  if (n == null) return "—";
  return opts?.compact && Math.abs(n) >= 10_000 ? currencyCompact.format(n) : currency.format(n);
}

/** Input is a ratio (0.042 → "4.2%") unless `isPercent`. */
export function formatPercent(n: number | null | undefined, opts?: { isPercent?: boolean; digits?: number }): string {
  if (n == null || Number.isNaN(n)) return "—";
  const v = opts?.isPercent ? n : n * 100;
  return `${v.toFixed(opts?.digits ?? 1)}%`;
}

export function formatPosition(n: number | null | undefined): string {
  if (n == null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function formatSigned(n: number | null | undefined, digits = 0): string {
  if (n == null || n === 0) return "0";
  return `${n > 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}`;
}

const shortDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Accepts a Date or a YYYY-MM-DD key; dates are UTC calendar days. */
export function formatDate(d: Date | string, style: "short" | "long" = "short"): string {
  const date = typeof d === "string" ? new Date(`${d}T00:00:00Z`) : d;
  return (style === "short" ? shortDate : longDate).format(date);
}

export function formatRelative(d: Date | null | undefined): string {
  if (!d) return "never";
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
