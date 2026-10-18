#!/usr/bin/env node
/**
 * Apply SQL migrations (db/migrations/*.sql) to the Supabase project
 * through the Management API. Each migration runs inside a single
 * transaction together with its bookkeeping row, so a failure leaves
 * nothing half-applied.
 *
 * Usage (from the project root):
 *   node scripts/db-apply.mjs            # apply all pending migrations
 *   node scripts/db-apply.mjs --list     # show what is applied / pending
 *
 * Requires .env in the project root:
 *   SUPABASE_PROJECT_REF=...
 *   SUPABASE_ACCESS_TOKEN=...   (scoped management token)
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = path.join(ROOT, "db", "migrations");
const API_BASE = "https://api.supabase.com/v1";

const argv = process.argv.slice(2);
const listOnly = argv.includes("--list");

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
  if (!res.ok) {
    throw new Error(`SQL request failed (${res.status}): ${text}`);
  }
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
    `create table if not exists public._app_migrations (
       id text primary key,
       applied_at timestamptz not null default now()
     );
     alter table public._app_migrations enable row level security;`
  );

  const appliedRows = await runQuery(
    ref,
    token,
    "select id from public._app_migrations order by id;"
  );
  const applied = new Set(appliedRows.map((r) => r.id));

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const pending = files.filter((f) => !applied.has(f));

  if (listOnly) {
    console.log("Applied:");
    for (const f of files) {
      console.log(`  ${applied.has(f) ? "[x]" : "[ ]"} ${f}`);
    }
    console.log(`Pending: ${pending.length}`);
    return;
  }

  if (pending.length === 0) {
    console.log("Nothing to do - all migrations are already applied.");
    return;
  }

  for (const file of pending) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    const wrapped = [
      "begin;",
      sql,
      `insert into public._app_migrations (id) values ('${file.replace(/'/g, "''")}');`,
      "commit;",
    ].join("\n");
    process.stdout.write(`  Applying ${file} ... `);
    await runQuery(ref, token, wrapped);
    console.log("done");
  }

  console.log(`Applied ${pending.length} migration(s).`);
}

main().catch((err) => {
  console.error(`\nMigration failed: ${err.message}`);
  process.exit(1);
});
