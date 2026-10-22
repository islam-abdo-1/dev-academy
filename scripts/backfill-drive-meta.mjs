#!/usr/bin/env node
/**
 * Backfill drive_file_name / drive_mime_type for material rows whose
 * url points at Google Drive and whose metadata is still empty.
 *
 * Usage (from the project root):
 *   node scripts/backfill-drive-meta.mjs
 *
 * Environment (or .env in the project root):
 *   GOOGLE_API_KEY=...
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_KEY=...   (falls back to SUPABASE_SERVICE_ROLE_KEY)
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TABLES = ["section_items", "lecture_items"];
const SLEEP_MS = 200;

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

async function loadDotEnv() {
  try {
    const text = await readFile(path.join(ROOT, ".env"), "utf8");
    return loadEnv(text);
  } catch {
    return {};
  }
}

function getDriveId(url) {
  if (!url) return null;
  let parsed;
  try {
    parsed = new URL(String(url).trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();

  if (host === "docs.google.com") {
    const match = parsed.pathname.match(
      /^\/(document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]+)/,
    );
    return match ? match[2] : null;
  }

  if (host !== "drive.google.com") return null;

  const folder = parsed.pathname.match(
    /\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]+)/,
  );
  if (folder) return folder[1];

  const file = parsed.pathname.match(/\/file\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)/);
  if (file) return file[1];

  const idParam = parsed.searchParams.get("id");
  if (idParam && /^[A-Za-z0-9_-]{10,}$/.test(idParam)) return idParam;

  return null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function supabaseRequest(env, pathname, init = {}) {
  const response = await fetch(`${env.url}/rest/v1/${pathname}`, {
    ...init,
    headers: {
      apikey: env.serviceKey,
      Authorization: `Bearer ${env.serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${response.status}: ${body.slice(0, 200)}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function main() {
  const dotenv = await loadDotEnv();
  const apiKey = process.env.GOOGLE_API_KEY || dotenv.GOOGLE_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || dotenv.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_KEY ||
    dotenv.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    dotenv.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey) {
    console.log("GOOGLE_API_KEY غير موجود.");
    console.log("1) افتح console.cloud.google.com واختار المشروع.");
    console.log("2) APIs & Services ← Library ← فعّل Google Drive API.");
    console.log("3) APIs & Services ← Credentials ← Create credentials ← API key.");
    console.log("4) حط المفتاح في .env باسم GOOGLE_API_KEY=... ثم شغّل الأمر تاني.");
    process.exitCode = 1;
    return;
  }

  if (!supabaseUrl || !serviceKey) {
    console.error("SUPABASE_URL أو SUPABASE_SERVICE_KEY غير موجود.");
    process.exitCode = 1;
    return;
  }

  const env = { url: supabaseUrl.replace(/\/$/, ""), serviceKey };
  const updated = [];
  const failed = [];
  let skipped = 0;

  for (const table of TABLES) {
    const query =
      "select=id,title,url" +
      "&drive_file_name=is.null" +
      "&or=(url.ilike.*drive.google.com*,url.ilike.*docs.google.com*)" +
      "&order=created_date.asc";

    let rows;
    try {
      rows = await supabaseRequest(env, `${table}?${query}`);
    } catch (error) {
      console.error(`[${table}] فشل قراءة الصفوف: ${error.message}`);
      continue;
    }

    for (const row of rows || []) {
      const fileId = getDriveId(row.url);
      if (!fileId) {
        skipped += 1;
        continue;
      }

      let meta;
      try {
        const response = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}` +
            `?fields=name,mimeType&key=${encodeURIComponent(apiKey)}&supportsAllDrives=true`,
        );
        if (!response.ok) {
          const body = await response.text();
          failed.push({
            table,
            id: fileId,
            title: row.title,
            status: response.status,
            reason: body.slice(0, 160),
          });
          console.log(`✗ ${table} / ${row.title || fileId} ← HTTP ${response.status}`);
          await sleep(SLEEP_MS);
          continue;
        }
        meta = await response.json();
      } catch (error) {
        failed.push({
          table,
          id: fileId,
          title: row.title,
          status: "network",
          reason: error.message,
        });
        console.log(`✗ ${table} / ${row.title || fileId} ← ${error.message}`);
        await sleep(SLEEP_MS);
        continue;
      }

      try {
        await supabaseRequest(env, `${table}?id=eq.${encodeURIComponent(row.id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            drive_file_name: meta.name || null,
            drive_mime_type: meta.mimeType || null,
          }),
        });
        updated.push({ table, title: meta.name, mimeType: meta.mimeType });
        console.log(`✓ ${table} / ${meta.name} (${meta.mimeType})`);
      } catch (error) {
        failed.push({
          table,
          id: fileId,
          title: row.title,
          status: "update",
          reason: error.message,
        });
        console.log(`✗ تحديث ${table} / ${row.title || fileId}: ${error.message}`);
      }

      await sleep(SLEEP_MS);
    }
  }

  console.log("\n===== الملخص =====");
  console.log(`اتحدّث: ${updated.length}`);
  console.log(`فشل: ${failed.length}`);
  console.log(`اتخطى (بدون ID): ${skipped}`);
  if (failed.length) {
    console.log("الفاشلون:");
    for (const item of failed) {
      console.log(
        `- [${item.table}] ${item.title || "(بدون عنوان)"} | id=${item.id} | ${item.status} | ${item.reason}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
