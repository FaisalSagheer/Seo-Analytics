// Vercel runs this instead of `npm run build` (the "vercel-build" script).
// Production deploys apply pending database migrations first, so the code never runs against an
// older schema. Preview deploys skip them: a branch's migrations must not change the live database.
// If a migration fails, the build stops here and the previous deployment stays live.
import { spawnSync } from "node:child_process";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const target = process.env.VERCEL_ENV ?? "local";
if (process.env.SKIP_MIGRATIONS === "true") {
  console.log("[vercel-build] SKIP_MIGRATIONS=true: not applying database migrations.");
} else if (target === "production") {
  console.log("[vercel-build] Production deploy: applying database migrations.");
  run("npx", ["prisma", "migrate", "deploy"]);
} else {
  console.log(`[vercel-build] ${target} deploy: skipping database migrations (they only run on production).`);
}

run("npx", ["prisma", "generate"]);
run("npx", ["next", "build"]);
