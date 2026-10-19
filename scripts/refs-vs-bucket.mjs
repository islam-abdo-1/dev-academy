import { createClient } from "@supabase/supabase-js";
import { readFile, readdir, writeFile } from "node:fs/promises";

const envText = await readFile("C:/Users/islam/dev-academy/.env", "utf8");
const env = {};
for (const rawLine of envText.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq === -1) continue;
  env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false },
});

const invite = JSON.parse(
  await readFile("C:/Users/islam/AppData/Local/Temp/opencode/bucket-inventory.json", "utf8"),
);
const bucketFiles = invite.map((f) => f.path);
const bucketSet = new Set(bucketFiles);

// collect referenced paths from DB
const refs = new Set();
for (const table of ["lecture_items", "section_items", "resources", "profiles"]) {
  const col = table === "profiles" ? "avatar_url" : "url";
  const { data } = await admin.from(table).select(col);
  for (const row of data ?? []) {
    const u = row[col];
    if (!u || typeof u !== "string") continue;
    const m = u.match(/\/storage\/v1\/object\/public\/media\/(.+)$/);
    if (m) refs.add(decodeURIComponent(m[1]));
  }
}

console.log(`bucket files: ${bucketFiles.length}`);
console.log(`referenced by DB: ${refs.size}`);

const missingRefs = [...refs].filter((r) => !bucketSet.has(r));
console.log(`\nDB refs NOT in bucket (${missingRefs.length}):`);
for (const r of missingRefs.slice(0, 30)) console.log("  MISSING:", r);

const orphans = bucketFiles.filter(
  (f) =>
    !refs.has(f) &&
    !f.startsWith("avatars/") &&
    !f.startsWith("drive/"),
);
console.log(`\nBucket files NOT referenced (excluding avatars/drive) (${orphans.length}):`);
for (const o of orphans) console.log("  ORPHAN:", o);
