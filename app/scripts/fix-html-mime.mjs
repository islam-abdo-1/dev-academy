#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ROOT = path.resolve(APP_ROOT, "..");
const BUCKET = "media";
const PAGE_SIZE = 1000;

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const pathArg = args.find((arg) => arg.startsWith("--path="));
const targetPath = pathArg ? pathArg.slice("--path=".length).replace(/^\/+/, "") : "";

function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, eq).trim()] = value;
  }
  return env;
}

const env = parseEnv(await readFile(path.join(PROJECT_ROOT, ".env"), "utf8"));
const baseUrl = (env.SUPABASE_URL || "").replace(/\/+$/, "");
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!baseUrl || !serviceKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env");
}

const authHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
};

const encodePath = (value) =>
  value.split("/").map((part) => encodeURIComponent(part)).join("/");

async function listFolder(prefix, offset = 0) {
  const response = await fetch(`${baseUrl}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      prefix,
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    }),
  });
  if (!response.ok) {
    throw new Error(`list ${prefix || "/"}: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function downloadObject(objectPath) {
  const response = await fetch(
    `${baseUrl}/storage/v1/object/${BUCKET}/${encodePath(objectPath)}`,
    { headers: authHeaders },
  );
  if (!response.ok) {
    throw new Error(`download ${objectPath}: ${response.status} ${await response.text()}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function uploadHtml(objectPath, body) {
  const response = await fetch(
    `${baseUrl}/storage/v1/object/${BUCKET}/${encodePath(objectPath)}`,
    {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "x-upsert": "true",
      },
      body,
    },
  );
  if (!response.ok) {
    throw new Error(`upload ${objectPath}: ${response.status} ${await response.text()}`);
  }
}

const isHtmlName = (name) => /\.html?$/i.test(name);
const isHtmlMime = (mime) => /^text\/html(?:;|$)/i.test(mime || "");

async function walk(prefix) {
  let offset = 0;
  let checked = 0;
  let fixed = 0;

  while (true) {
    const entries = await listFolder(prefix, offset);
    for (const entry of entries) {
      const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null || !entry.metadata) {
        const nested = await walk(objectPath);
        checked += nested.checked;
        fixed += nested.fixed;
        continue;
      }
      if (!isHtmlName(entry.name)) continue;
      checked += 1;
      const mime = entry.metadata.mimetype || entry.metadata.mimeType || "";
      if (isHtmlMime(mime)) continue;

      console.log(`${apply ? "fixing" : "would fix"} ${objectPath} (${mime || "unknown"} -> text/html)`);
      if (apply) {
        const body = await downloadObject(objectPath);
        await uploadHtml(objectPath, body);
        console.log(`  updated ${objectPath}`);
      }
      fixed += 1;
    }
    if (entries.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { checked, fixed };
}

let result;
if (targetPath) {
  if (!isHtmlName(targetPath)) {
    throw new Error(`--path must point to an .html/.htm file: ${targetPath}`);
  }
  const body = await downloadObject(targetPath);
  console.log(`${apply ? "fixing" : "would fix"} ${targetPath} (forced text/html)`);
  if (apply) await uploadHtml(targetPath, body);
  result = { checked: 1, fixed: 1 };
} else {
  result = await walk("");
}

console.log(
  `\n${apply ? "Applied" : "Dry run"}: ${result.checked} HTML file(s) checked, ${result.fixed} ${apply ? "updated" : "need updating"}.`,
);
if (!apply && result.fixed > 0) {
  console.log("Run again with --apply to update the objects.");
}
