#!/usr/bin/env node
/**
 * Merge one duplicate subject into a canonical subject.
 *
 * The canonical subject keeps its content, ratings, shares and saved
 * items. The duplicate subject's placement is added to the canonical
 * subject, then the duplicate subject is deleted (its content cascades).
 *
 * Dry run (default):
 *   node scripts/merge-subjects.mjs \
 *     --canonical <subject-id> --duplicate <subject-id> \
 *     [--major cybersecurity] [--year year-2] [--semester sem-1] [--code IT226]
 *
 * Apply after reviewing the report:
 *   node scripts/merge-subjects.mjs ... --apply
 *
 * Safety: the script refuses to delete a duplicate that has ratings,
 * share links, saved items, announcements, resources, or content that
 * does not exist on the canonical subject.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^"|"$/g, "");
  }
  return env;
}

function parseArgs(argv) {
  const args = { apply: false, allowReferenced: false, allowContentLoss: false };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--apply") args.apply = true;
    else if (value === "--allow-referenced") args.allowReferenced = true;
    else if (value === "--allow-content-loss") args.allowContentLoss = true;
    else if (value.startsWith("--")) {
      const key = value.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for --${key}`);
      }
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function requireValue(args, key) {
  const value = (args[key] || "").trim();
  if (!value) throw new Error(`--${key} is required`);
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const canonicalId = requireValue(args, "canonical");
  const duplicateId = requireValue(args, "duplicate");
  if (canonicalId === duplicateId) throw new Error("canonical and duplicate must differ");

  const env = loadEnv(await readFile(path.join(ROOT, ".env"), "utf8"));
  const base = (env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  async function rest(pathname, init = {}) {
    const response = await fetch(`${base}/rest/v1/${pathname}`, {
      ...init,
      headers: { ...headers, ...(init.headers || {}) },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${init.method || "GET"} ${pathname} -> ${response.status}: ${text.slice(0, 300)}`);
    }
    return text ? JSON.parse(text) : null;
  }

  async function oneSubject(id) {
    const rows = await rest(
      `subjects?select=id,name,english_name,code,major,year,semester&id=eq.${encodeURIComponent(id)}&limit=1`,
    );
    return rows?.[0] || null;
  }

  async function count(table, query) {
    const response = await fetch(`${base}/rest/v1/${table}?select=*&${query}&limit=1`, {
      headers: { ...headers, Prefer: "count=exact" },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`COUNT ${table} -> ${response.status}: ${text.slice(0, 300)}`);
    }
    const range = response.headers.get("content-range") || "";
    const total = Number(range.split("/")[1] || 0);
    return Number.isFinite(total) ? total : 0;
  }

  async function contentRows(table, subjectId, select) {
    return rest(
      `${table}?select=${select}&subject_id=eq.${encodeURIComponent(subjectId)}&limit=500`,
    );
  }

  const [canonical, duplicate] = await Promise.all([
    oneSubject(canonicalId),
    oneSubject(duplicateId),
  ]);
  if (!canonical) throw new Error(`canonical subject not found: ${canonicalId}`);
  if (!duplicate) throw new Error(`duplicate subject not found: ${duplicateId}`);

  const tables = ["chapters", "lectures", "sections", "lecture_items", "section_items", "resources"];
  const duplicateCounts = {};
  const canonicalCounts = {};
  for (const table of tables) {
    duplicateCounts[table] = await count(
      table,
      `subject_id=eq.${encodeURIComponent(duplicateId)}`,
    );
    canonicalCounts[table] = await count(
      table,
      `subject_id=eq.${encodeURIComponent(canonicalId)}`,
    );
  }

  const duplicateItemIds = [];
  for (const table of ["lecture_items", "section_items", "resources"]) {
    const rows = await contentRows(table, duplicateId, "id");
    for (const row of rows || []) duplicateItemIds.push(row.id);
  }

  const inList = duplicateItemIds.length
    ? `in.(${duplicateItemIds.map((id) => encodeURIComponent(id)).join(",")})`
    : null;
  const referenced = {
    ratings: inList ? await count("material_ratings", `material_id=${inList}`) : 0,
    shares: inList ? await count("share_tokens", `resource_id=${inList}`) : 0,
    subjectShares: await count(
      "share_tokens",
      `resource_type=eq.course&resource_id=eq.${encodeURIComponent(duplicateId)}`,
    ),
    saved: await count("user_saved_items", `subject_id=eq.${encodeURIComponent(duplicateId)}`),
    announcements: await count(
      "announcements",
      `subject_id=eq.${encodeURIComponent(duplicateId)}`,
    ),
  };

  async function signatures(table, subjectId, fields) {
    const rows = await contentRows(table, subjectId, `id,${fields.join(",")}`);
    return new Set(
      (rows || []).map((row) => fields.map((field) => String(row[field] ?? "")).join("|")),
    );
  }

  const comparisons = [];
  for (const [table, fields] of [
    ["chapters", ["title"]],
    ["lectures", ["title"]],
    ["sections", ["title"]],
    ["lecture_items", ["title", "url", "file_type", "type"]],
    ["section_items", ["title", "url", "file_type", "type"]],
  ]) {
    const canonicalSet = await signatures(table, canonicalId, fields);
    const duplicateSet = await signatures(table, duplicateId, fields);
    const onlyDuplicate = [...duplicateSet].filter((value) => !canonicalSet.has(value));
    comparisons.push({ table, onlyDuplicate });
  }

  const placement = {
    subject_id: canonicalId,
    major: (args.major || duplicate.major || "").trim(),
    year: (args.year || duplicate.year || "").trim(),
    semester: (args.semester || duplicate.semester || "").trim(),
    code: (args.code || duplicate.code || "").trim(),
    is_primary: false,
    sort_order: 2,
  };

  if (!["ai", "cybersecurity"].includes(placement.major)) {
    throw new Error(`invalid placement major: ${placement.major}`);
  }
  if (!["year-1", "year-2", "year-3", "year-4"].includes(placement.year)) {
    throw new Error(`invalid placement year: ${placement.year}`);
  }
  if (!["sem-1", "sem-2"].includes(placement.semester)) {
    throw new Error(`invalid placement semester: ${placement.semester}`);
  }

  const blockingReferences = Object.entries(referenced).filter(([, value]) => value > 0);
  const blockingContent = comparisons.filter((entry) => entry.onlyDuplicate.length > 0);

  console.log("Canonical:", JSON.stringify(canonical));
  console.log("Duplicate:", JSON.stringify(duplicate));
  console.log("Placement to add:", JSON.stringify(placement));
  console.log("Duplicate content:", JSON.stringify(duplicateCounts));
  console.log("Canonical content:", JSON.stringify(canonicalCounts));
  console.log("References on duplicate:", JSON.stringify(referenced));
  for (const entry of comparisons) {
    console.log(
      `Content comparison ${entry.table}: only-duplicate=${entry.onlyDuplicate.length}`,
    );
    for (const value of entry.onlyDuplicate.slice(0, 5)) {
      console.log("  only-duplicate:", value.slice(0, 180));
    }
  }

  if (blockingReferences.length && !args.allowReferenced) {
    throw new Error(
      `duplicate has references (${blockingReferences
        .map(([name, value]) => `${name}=${value}`)
        .join(", ")}); rerun with --allow-referenced only after reviewing them`,
    );
  }
  if (blockingContent.length && !args.allowContentLoss) {
    throw new Error(
      `duplicate has content missing from canonical (${blockingContent
        .map((entry) => entry.table)
        .join(", ")}); rerun with --allow-content-loss only after reviewing it`,
    );
  }
  if (duplicateCounts.resources > 0 && !args.allowContentLoss) {
    throw new Error(
      `duplicate has ${duplicateCounts.resources} resource(s); move them before deleting the duplicate`,
    );
  }

  if (!args.apply) {
    console.log("\nDRY RUN — no changes written. Add --apply to execute.");
    return;
  }

  console.log("\nApplying merge...");
  const upsert = await fetch(
    `${base}/rest/v1/subject_placements?on_conflict=subject_id,major,year,semester`,
    {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify([placement]),
    },
  );
  if (!upsert.ok) {
    const text = await upsert.text();
    throw new Error(`placement upsert failed: ${upsert.status} ${text.slice(0, 300)}`);
  }

  const deleted = await fetch(
    `${base}/rest/v1/subjects?id=eq.${encodeURIComponent(duplicateId)}`,
    { method: "DELETE", headers: { ...headers, Prefer: "return=representation" } },
  );
  if (!deleted.ok) {
    const text = await deleted.text();
    throw new Error(`subject delete failed: ${deleted.status} ${text.slice(0, 300)}`);
  }

  const [remaining, catalog] = await Promise.all([
    oneSubject(duplicateId),
    rest(
      `subject_catalog?select=id,major,year,semester,code,is_primary&id=eq.${encodeURIComponent(canonicalId)}&order=sort_order`,
    ),
  ]);
  console.log("Duplicate remaining:", remaining ? "YES (unexpected)" : "no");
  console.log("Canonical catalog rows:", JSON.stringify(catalog));
  console.log("Merge complete.");
}

main().catch((error) => {
  console.error("ERROR:", error.message);
  process.exitCode = 1;
});
