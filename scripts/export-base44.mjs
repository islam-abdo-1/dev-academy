#!/usr/bin/env node
/**
 * Export everything from Base44: all entities + uploaded files.
 *
 * Usage (from the project root):
 *   node scripts/export-base44.mjs
 *   node scripts/export-base44.mjs --entity=Subject --entity=Message
 *   node scripts/export-base44.mjs --no-files
 *
 * Requires .env in the project root (see .env.example):
 *   BASE44_APP_ID=...
 *   BASE44_PAT=...      (read-only personal access token)
 *
 * Output goes to exports/base44-<timestamp>/ :
 *   - <Entity>.json for every entity
 *   - _Users.json  (best effort, if the endpoint accepts it)
 *   - files/...    (downloaded uploads, grouped by entity + record)
 *   - manifest.json (counts, errors, url -> local file map)
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const API_BASE = "https://app.base44.com/api";
const PAGE_LIMIT = 500;
const PAGE_DELAY_MS = 200;
const MAX_PAGES = 200;

const ALL_ENTITIES = [
  "Subject",
  "Chapter",
  "Lecture",
  "Section",
  "LectureItem",
  "SectionItem",
  "Resource",
  "Favorite",
  "SubjectView",
  "ActivityLog",
  "Message",
  "Announcement",
];

const USERS_ENDPOINT_CANDIDATES = [
  (appId) => `${API_BASE}/apps/${appId}/entities/User`,
  (appId) => `${API_BASE}/apps/${appId}/users/v2/list`,
];

const ITEM_FIELDS = ["items", "records", "data"];

// Hosts we treat as "uploaded files": download them.
// Anything else (youtube, external links, ...) is only recorded for review.
const FILE_HOST_MARKERS = [
  "base44",
  "amazonaws",
  "googleapis",
  "cloudfront",
  "r2.dev",
  "backblazeb2",
  "supabase",
];

const argv = process.argv.slice(2);
const onlyEntities = argv
  .filter((a) => a.startsWith("--entity="))
  .map((a) => a.slice("--entity=".length));
const skipFiles = argv.includes("--no-files");
const entities = onlyEntities.length > 0 ? onlyEntities : ALL_ENTITIES;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loadEnvFile(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function apiGet(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const detail =
      body?.detail ?? body?.message ?? (text ? text.slice(0, 160) : res.statusText);
    const error = new Error(`HTTP ${res.status} - ${detail}`);
    error.status = res.status;
    throw error;
  }
  return body;
}

let currentAppId = "";

async function listAllRecords(token, entity) {
  const records = [];
  let cursor = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });
    if (cursor) params.set("cursor", cursor);
    const url =
      `${API_BASE}/apps/${currentAppId}/entities/${encodeURIComponent(entity)}/v2/list?` +
      params.toString();
    const body = await apiGet(url, token);
    const items = ITEM_FIELDS.map((key) => body?.[key]).find(Array.isArray) ?? [];
    records.push(...items);
    process.stdout.write(`\r  ${entity}: ${records.length} record(s) fetched`);
    cursor = body?.next_cursor ?? body?.cursor ?? null;
    const hasMore = body?.has_more ?? Boolean(cursor);
    if (!hasMore || !cursor || items.length === 0) break;
    await sleep(PAGE_DELAY_MS);
  }
  process.stdout.write("\n");
  return records;
}

async function tryListUsers(token) {
  for (const build of USERS_ENDPOINT_CANDIDATES) {
    try {
      const url = `${build(currentAppId)}?limit=10000`;
      const body = await apiGet(url, token);
      const items = Array.isArray(body)
        ? body
        : (ITEM_FIELDS.map((key) => body?.[key]).find(Array.isArray) ?? []);
      return { items, endpoint: build(currentAppId) };
    } catch {
      // try next candidate
    }
  }
  return null;
}

function extractFileUrls(record) {
  const urls = [];
  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== "string") continue;
    if (!value.startsWith("http")) continue;
    if (!/url$/i.test(key)) continue;
    urls.push(value);
  }
  return urls;
}

function isUploadedFile(url) {
  try {
    const host = new URL(url).host.toLowerCase();
    return FILE_HOST_MARKERS.some((marker) => host.includes(marker));
  } catch {
    return false;
  }
}

function safeFileName(url) {
  try {
    const parsed = new URL(url);
    const base = path.basename(parsed.pathname);
    const name = base ? decodeURIComponent(base) : "file";
    return name.replace(/[<>:"/\\|?*]/g, "_");
  } catch {
    return "file";
  }
}

async function main() {
  const envFile = path.join(ROOT, ".env");
  if (!existsSync(envFile)) {
    console.error(`ERROR: .env not found at ${envFile}`);
    console.error("Copy .env.example to .env and fill BASE44_APP_ID + BASE44_PAT.");
    process.exit(1);
  }
  const env = loadEnvFile(await readFile(envFile, "utf8"));
  currentAppId = env.BASE44_APP_ID ?? "";
  const token = env.BASE44_PAT ?? "";
  if (!currentAppId || !token) {
    console.error("ERROR: BASE44_APP_ID and/or BASE44_PAT are empty in .env");
    console.error("Create a read-only personal access token in Base44 and paste it.");
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  const outDir = path.join(ROOT, "exports", `base44-${stamp}`);
  await mkdir(outDir, { recursive: true });

  const manifest = {
    appId: currentAppId,
    exportedAt: new Date().toISOString(),
    entities: {},
    users: null,
    files: { downloaded: 0, failed: 0, skippedExternal: [], byUrl: {} },
    errors: [],
  };

  const downloadedByUrl = new Map();
  const usedPaths = new Set();
  let totalFiles = 0;

  console.log(`Exporting app ${currentAppId}`);
  console.log(`Output: ${outDir}`);
  console.log("");

  for (const entity of entities) {
    try {
      const records = await listAllRecords(token, entity);
      await writeFile(
        path.join(outDir, `${entity}.json`),
        JSON.stringify(records, null, 2),
        "utf8"
      );
      manifest.entities[entity] = records.length;

      if (!skipFiles) {
        for (const record of records) {
          for (const url of extractFileUrls(record)) {
            if (downloadedByUrl.has(url)) continue;
            if (!isUploadedFile(url)) {
              manifest.files.skippedExternal.push({
                entity,
                recordId: record.id ?? null,
                url,
              });
              continue;
            }
            const dir = path.join("files", entity, String(record.id ?? "unknown"));
            let relPath = path.join(dir, safeFileName(url));
            let n = 2;
            while (usedPaths.has(relPath.toLowerCase())) {
              const ext = path.extname(relPath);
              relPath = path.join(dir, `${path.basename(relPath, ext)}-${n}${ext}`);
              n += 1;
            }
            usedPaths.add(relPath.toLowerCase());
            const absPath = path.join(outDir, relPath);
            try {
              await mkdir(path.dirname(absPath), { recursive: true });
              const res = await fetch(url);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const buf = Buffer.from(await res.arrayBuffer());
              await writeFile(absPath, buf);
              downloadedByUrl.set(url, relPath);
              manifest.files.downloaded += 1;
              totalFiles += 1;
              process.stdout.write(`\r  files: ${totalFiles} downloaded`);
            } catch (error) {
              manifest.files.failed += 1;
              manifest.errors.push({
                entity,
                recordId: record.id ?? null,
                url,
                error: String(error?.message ?? error),
              });
            }
          }
        }
      }
    } catch (error) {
      const message = String(error?.message ?? error);
      console.error(`  ${entity}: FAILED - ${message}`);
      manifest.errors.push({ entity, error: message });
    }
  }
  if (!skipFiles && totalFiles > 0) process.stdout.write("\n");

  const users = await tryListUsers(token);
  if (users) {
    await writeFile(
      path.join(outDir, "_Users.json"),
      JSON.stringify(users.items, null, 2),
      "utf8"
    );
    manifest.users = { count: users.items.length, endpoint: users.endpoint };
  } else {
    manifest.errors.push({
      entity: "User",
      error: "Could not fetch app users (endpoint candidates did not work)",
    });
  }

  manifest.files.byUrl = Object.fromEntries(downloadedByUrl);
  await writeFile(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  console.log("");
  console.log("Done. Summary:");
  for (const [entity, count] of Object.entries(manifest.entities)) {
    console.log(`  ${entity}: ${count}`);
  }
  if (manifest.users) console.log(`  Users: ${manifest.users.count}`);
  if (!skipFiles) {
    console.log(`  Files downloaded: ${manifest.files.downloaded}`);
    if (manifest.files.failed > 0) console.log(`  Files failed: ${manifest.files.failed}`);
  }
  if (manifest.errors.length > 0) {
    console.log(`  Errors: ${manifest.errors.length} (full details in manifest.json)`);
  }
  console.log(`  Output: ${outDir}`);
}

main().catch((error) => {
  console.error("FATAL:", error);
  process.exit(1);
});
