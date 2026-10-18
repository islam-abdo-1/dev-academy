#!/usr/bin/env node
/**
 * Lock down the public "media" storage bucket:
 *  - file_size_limit: 50MB (platform-free cap; client blocks >45MB)
 *  - allowed_mime_types: pdf/images/html only (no SVG)
 *
 * The Management API has no bucket-update REST endpoint, so this runs
 * an idempotent SQL update through the database/query endpoint.
 *
 * Usage (from the project root):
 *   node scripts/set-bucket-limits.mjs
 *
 * Requires .env in the project root:
 *   SUPABASE_PROJECT_REF=...
 *   SUPABASE_ACCESS_TOKEN=...   (scoped management token)
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_BASE = "https://api.supabase.com/v1";

function loadEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return env;
}

async function runQuery(ref, token, query) {
  const res = await fetch(`${API_BASE}/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL request failed (${res.status}): ${text}`);
  return text ? JSON.parse(text) : [];
}

async function main() {
  const envText = await readFile(path.join(ROOT, ".env"), "utf8");
  const env = loadEnv(envText);
  const ref = env.SUPABASE_PROJECT_REF;
  const token = env.SUPABASE_ACCESS_TOKEN;
  if (!ref || !token) {
    console.error("Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN in .env");
    process.exit(1);
  }

  await runQuery(
    ref,
    token,
    `update storage.buckets
        set file_size_limit = 52428800,
            allowed_mime_types = array['application/pdf','image/png','image/jpeg','image/webp','text/html']
      where id = 'media';`
  );

  const rows = await runQuery(
    ref,
    token,
    `select id, public, file_size_limit, allowed_mime_types
       from storage.buckets where id = 'media';`
  );
  const bucket = rows[0] || {};
  console.log("Bucket updated:");
  console.log(`  id: ${bucket.id}`);
  console.log(`  public: ${bucket.public}`);
  console.log(`  file_size_limit: ${bucket.file_size_limit}`);
  console.log(`  allowed_mime_types: ${JSON.stringify(bucket.allowed_mime_types)}`);
}

main().catch((err) => {
  console.error(`Failed: ${err.message}`);
  process.exit(1);
});
