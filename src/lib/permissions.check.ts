// Run with: npx tsx src/lib/permissions.check.ts
import assert from "node:assert/strict";
import { PERMISSION_KEYS, PERMISSION_LAYOUT, MERCHANT_PERMISSIONS, describePermissions, sanitizePermissions } from "@/lib/permissions";

// Every permission appears in the layout exactly once, and the layout names no unknown one
const shown = PERMISSION_LAYOUT.flatMap((a) => a.groups.flatMap((g) => g.pages.flatMap((p) => [p.create, p.edit, p.delete].filter(Boolean))));
assert.equal(new Set(shown).size, shown.length, "a permission is listed twice");
assert.deepEqual([...shown].sort(), [...PERMISSION_KEYS].sort(), "layout and PERMISSIONS differ");
// Each key is named for the action its slot shows
for (const a of PERMISSION_LAYOUT) for (const g of a.groups) for (const p of g.pages) for (const act of ["create", "edit", "delete"] as const) if (p[act]) assert.ok(p[act]!.endsWith("." + act), `${p[act]} is in the ${act} column`);

// Old roles keep exactly what they had
assert.deepEqual(sanitizePermissions(["keywords.manage"]), ["rankings.create", "rankings.delete"]);
assert.deepEqual(sanitizePermissions(["data.sync"]).sort(), ["analytics.edit", "audit.create", "backlinks.create", "backlinks.delete", "rankings.edit"]);
assert.deepEqual(sanitizePermissions(["providers.manage", "apikeys.manage"]), ["google.edit", "apikeys.create"]);
assert.deepEqual([...sanitizePermissions(["merchant.manage"])].sort(), [...MERCHANT_PERMISSIONS].sort());
assert.deepEqual(sanitizePermissions(["projects.create", "research.use", "made.up", 5, null]), ["projects.create"]);
assert.deepEqual(sanitizePermissions("nope"), []);
// New and old keys together don't duplicate
assert.deepEqual(sanitizePermissions(["rankings.create", "keywords.manage"]), ["rankings.create", "rankings.delete"]);
// The Merchant Center set is all and only the Merchant Center keys
assert.ok(MERCHANT_PERMISSIONS.every((k) => !["analytics.edit", "projects.edit", "google.edit"].includes(k)));
assert.equal(describePermissions(["products.create", "products.edit", "feeds.delete"]), "Products: create, edit · Data sources: delete");
console.log(`permissions: all checks passed (${PERMISSION_KEYS.length} permissions)`);
