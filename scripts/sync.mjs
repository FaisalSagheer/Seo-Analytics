// Triggers the daily sync on a running server: `npm run sync`.
// Schedule it with cron (`0 6 * * * cd /app && npm run sync`) or Windows Task Scheduler.
import "dotenv/config";

const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("CRON_SECRET is not set.");
  process.exit(1);
}

const res = await fetch(`${base}/api/cron/sync`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`Sync failed (${res.status}):`, body);
  process.exit(1);
}
for (const p of body.data ?? []) {
  const parts = Object.entries(p.result)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${v.ok ? "ok" : `FAILED (${v.message})`}`);
  console.log(`${p.domain}: ${parts.join(", ")}`);
}
