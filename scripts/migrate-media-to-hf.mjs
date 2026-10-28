#!/usr/bin/env node
/**
 * One-off migration helper: move legacy Supabase Storage media links to the
 * public Hugging Face dataset.
 *
 * Usage:
 *   node scripts/migrate-media-to-hf.mjs inventory
 *   node scripts/migrate-media-to-hf.mjs rewrite --apply [--batch-size 25]
 *   node scripts/migrate-media-to-hf.mjs verify
 *
 * `inventory` is read-only. `rewrite` prints the planned updates and does
 * nothing unless --apply is passed. Progress is stored under
 * exports/media-migration/ so an interrupted rewrite can resume.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "exports", "media-migration");
const INVENTORY_PATH = path.join(
  ROOT,
  "exports",
  "backups",
  "20261028_192100",
  "media-inventory.tsv"
);
const SOURCES = [
  { table: "lecture_items", column: "url" },
  { table: "section_items", column: "url" },
  { table: "profiles", column: "avatar_url" },
];

function loadEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv(await readFile(path.join(ROOT, ".env"), "utf8"));
for (const key of [
  "SUPABASE_URL",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_PROJECT_REF",
  "HF_USER",
  "HF_REPO",
]) {
  if (!env[key]) throw new Error(`${key} is missing from .env`);
}

const OLD_PREFIX = `${env.SUPABASE_URL}/storage/v1/object/public/media/`;
const HF_BASE = `https://huggingface.co/datasets/${env.HF_USER}/${env.HF_REPO}/resolve/main/legacy/`;

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function query(sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  if (!res.ok) {
    throw new Error(`database query failed ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }
  const body = await res.json();
  return body;
}

async function fetchRows(table, column) {
  const rows = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const page = await query(
      `select id, ${column} as url from public.${table} ` +
        `where ${column} like ${sqlQuote(`%${OLD_PREFIX}%`)} ` +
        `order by id limit ${pageSize} offset ${offset}`
    );
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function parsePath(url) {
  const index = url.indexOf(OLD_PREFIX);
  if (index === -1) return null;
  const rest = url.slice(index + OLD_PREFIX.length);
  const queryIndex = rest.indexOf("?");
  const rawPath = queryIndex === -1 ? rest : rest.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : rest.slice(queryIndex);
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    decoded = rawPath;
  }
  return { path: decoded, query };
}

function hfUrl(objectPath, query = "") {
  const encoded = objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${HF_BASE}${encoded}${query}`;
}

async function readInventory() {
  try {
    const text = await readFile(INVENTORY_PATH, "utf8");
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.split("\t"))
      .map(([objectPath, storedPath, size]) => ({
        path: objectPath,
        storedPath,
        size: Number(size),
      }));
  } catch {
    return [];
  }
}

async function buildPlan() {
  const rows = [];
  for (const source of SOURCES) {
    const records = await fetchRows(source.table, source.column);
    for (const record of records) {
      const parsed = parsePath(record.url);
      if (!parsed) continue;
      rows.push({
        table: source.table,
        column: source.column,
        id: record.id,
        oldUrl: record.url,
        path: parsed.path,
        query: parsed.query,
        newUrl: hfUrl(parsed.path, parsed.query),
      });
    }
  }
  const inventory = await readInventory();
  const inventoryPaths = new Set(inventory.map((row) => row.path));
  const referencedPaths = new Set(rows.map((row) => row.path));
  const missingObjects = [...referencedPaths].filter(
    (objectPath) => !inventoryPaths.has(objectPath)
  );
  const unreferencedObjects = [...inventoryPaths].filter(
    (objectPath) => !referencedPaths.has(objectPath)
  );
  return {
    generatedAt: new Date().toISOString(),
    oldPrefix: OLD_PREFIX,
    hfBase: HF_BASE,
    inventoryPath: INVENTORY_PATH,
    rows,
    referencedPaths: [...referencedPaths].sort(),
    missingObjects: missingObjects.sort(),
    unreferencedObjects: unreferencedObjects.sort(),
  };
}

async function readPlan() {
  return JSON.parse(await readFile(path.join(OUT_DIR, "inventory.json"), "utf8"));
}

async function readProgress() {
  try {
    return JSON.parse(await readFile(path.join(OUT_DIR, "progress.json"), "utf8"));
  } catch {
    return { done: [] };
  }
}

function keyOf(row) {
  return `${row.table}:${row.id}:${row.column}`;
}

async function cmdInventory() {
  const plan = await buildPlan();
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUT_DIR, "inventory.json"),
    `${JSON.stringify(plan, null, 2)}\n`
  );
  const byTable = {};
  for (const row of plan.rows) {
    byTable[row.table] = (byTable[row.table] || 0) + 1;
  }
  console.log(`rows needing rewrite: ${plan.rows.length}`);
  for (const [table, count] of Object.entries(byTable)) {
    console.log(`  ${table}: ${count}`);
  }
  console.log(`distinct referenced objects: ${plan.referencedPaths.length}`);
  console.log(`inventory objects: ${plan.unreferencedObjects.length + plan.referencedPaths.length - plan.missingObjects.length}`);
  console.log(`referenced but missing from inventory: ${plan.missingObjects.length}`);
  for (const objectPath of plan.missingObjects.slice(0, 20)) {
    console.log(`  MISSING ${objectPath}`);
  }
  console.log(`inventory objects without an active link: ${plan.unreferencedObjects.length}`);
  for (const objectPath of plan.unreferencedObjects.slice(0, 20)) {
    console.log(`  UNREFERENCED ${objectPath}`);
  }
  console.log(`plan written to ${path.join(OUT_DIR, "inventory.json")}`);
}

async function cmdRewrite(args) {
  const apply = args.includes("--apply");
  const batchIndex = args.indexOf("--batch-size");
  const batchSize = batchIndex === -1 ? 25 : Number(args[batchIndex + 1]) || 25;
  const plan = await readPlan();
  const progress = await readProgress();
  const done = new Set(progress.done);

  const pending = [];
  for (const row of plan.rows) {
    const key = keyOf(row);
    if (!done.has(key) && row.oldUrl !== row.newUrl) pending.push({ ...row, key });
  }

  const batches = [];
  for (let index = 0; index < pending.length; index += batchSize) {
    batches.push(pending.slice(index, index + batchSize));
  }

  console.log(
    `${apply ? "APPLY" : "DRY RUN"}: ${pending.length} updates in ${batches.length} batches of ${batchSize}`
  );

  for (const [batchNumber, batch] of batches.entries()) {
    const groups = new Map();
    for (const row of batch) {
      const key = `${row.table}:${row.column}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
    const statements = [];
    for (const rows of groups.values()) {
      const values = rows
        .map(
          (row) =>
            `(${sqlQuote(row.id)}, ${sqlQuote(row.newUrl)}, ${sqlQuote(row.oldUrl)})`
        )
        .join(",\n    ");
      const { table, column } = rows[0];
      statements.push(
        `update public.${table} as t set ${column} = v.new_url ` +
          `from (values\n    ${values}\n  ) as v(id, new_url, old_url) ` +
          `where t.id = v.id and t.${column} = v.old_url returning t.id;`
      );
    }
    if (!apply) {
      console.log(`\n--- batch ${batchNumber + 1}/${batches.length} ---`);
      for (const statement of statements) console.log(statement);
      continue;
    }

    let updated = 0;
    for (const statement of statements) {
      const result = await query(statement);
      updated += result.length;
    }

    // A retried batch may already contain rows updated by an interrupted run.
    // Confirm the final state for every row instead of trusting the row count.
    const confirmed = new Set();
    for (const [key, rows] of groups.entries()) {
      const [table, column] = key.split(":");
      const ids = rows.map((row) => sqlQuote(row.id)).join(", ");
      const state = await query(
        `select id, ${column} as value from public.${table} where id in (${ids})`
      );
      const byId = new Map(state.map((row) => [row.id, row.value]));
      for (const row of rows) {
        if (byId.get(row.id) === row.newUrl) confirmed.add(row.id);
      }
    }
    if (confirmed.size !== batch.length) {
      console.error(
        `batch ${batchNumber + 1}: expected ${batch.length} rows at the new URL, got ${confirmed.size}; stopping.`
      );
      process.exitCode = 1;
      return;
    }
    if (updated !== batch.length) {
      console.log(
        `batch ${batchNumber + 1}: ${batch.length - updated} rows were already updated by a previous attempt`
      );
    }
    progress.done.push(...batch.map((row) => row.key));
    progress.updatedAt = new Date().toISOString();
    await writeFile(
      path.join(OUT_DIR, "progress.json"),
      `${JSON.stringify(progress, null, 2)}\n`
    );
    console.log(`batch ${batchNumber + 1}/${batches.length}: updated ${updated}`);
  }

  if (apply && pending.length === 0) console.log("nothing left to rewrite");
}

async function cmdRollback() {
  const plan = await readPlan();
  const lines = [
    "-- Generated by scripts/migrate-media-to-hf.mjs rollback",
    `-- ${new Date().toISOString()}`,
    "-- Restores every rewritten link to its Supabase Storage URL.",
    "",
  ];
  for (const row of plan.rows) {
    lines.push(
      `update public.${row.table} set ${row.column} = ${sqlQuote(row.oldUrl)} ` +
        `where id = ${sqlQuote(row.id)} and ${row.column} = ${sqlQuote(row.newUrl)};`
    );
  }
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, "rollback.sql"), `${lines.join("\n")}\n`);
  console.log(`rollback written to ${path.join(OUT_DIR, "rollback.sql")} (${plan.rows.length} updates)`);
}

async function cmdVerify() {
  const oldUrl = `${OLD_PREFIX}%`;
  const counts = await query(
    SOURCES.map(
      ({ table, column }) =>
        `select '${table}.${column}' as column_name, count(*)::int as remaining ` +
        `from public.${table} where ${column} like ${sqlQuote(oldUrl)}`
    ).join(" union all ") + " order by 1"
  );
  let remaining = 0;
  for (const row of counts) {
    remaining += Number(row.remaining);
    console.log(`${row.column_name}: ${row.remaining} legacy links`);
  }

  const plan = await readPlan();
  const inventory = await readInventory();
  const sizeByPath = new Map(inventory.map((row) => [row.path, row.size]));
  const sample = [...plan.referencedPaths]
    .sort(() => Math.random() - 0.5)
    .slice(0, 25);
  let failures = 0;
  for (const objectPath of sample) {
    const url = hfUrl(objectPath);
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    const size = Number(res.headers.get("content-length"));
    const expected = sizeByPath.get(objectPath);
    const sizeOk = !Number.isFinite(size) || size === expected;
    console.log(
      `${res.ok && sizeOk ? "OK" : "FAIL"} ${res.status} ${size || "?"}/${expected} ${objectPath}`
    );
    if (!res.ok || !sizeOk) failures += 1;
  }
  if (remaining > 0 || failures > 0) process.exitCode = 1;
}

const [command, ...args] = process.argv.slice(2);
if (command === "inventory") await cmdInventory();
else if (command === "rewrite") await cmdRewrite(args);
else if (command === "rollback") await cmdRollback();
else if (command === "verify") await cmdVerify();
else {
  console.error("usage: migrate-media-to-hf.mjs <inventory|rewrite|rollback|verify>");
  process.exitCode = 2;
}
