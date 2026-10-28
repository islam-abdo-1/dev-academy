#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import os from "node:os";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BACKUP_ROOT = path.join(ROOT, "exports", "backups");
const DEFAULT_ONEDRIVE = "C:\\Users\\islam\\OneDrive\\DevAcademyBackups";
const DEFAULT_PG_DUMP = "C:\\Users\\islam\\Tools\\pgsql17\\bin\\pg_dump.exe";
const DEFAULT_7ZR = "C:\\Users\\islam\\Tools\\7zr.exe";
const DEFAULT_CURL = "C:\\Windows\\System32\\curl.exe";
const RETENTION_DAYS = 14;

function loadEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[line.slice(0, eq).trim()] = value;
  }
  return env;
}

function logLine(message) {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  return line;
}

function encodePath(value) {
  return value.split("/").map(encodeURIComponent).join("/");
}

function safeJoin(root, relative) {
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(`unsafe path: ${relative}`);
  }
  return target;
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

async function download(url, headers, destination) {
  const res = await fetch(url, { headers, redirect: "follow" });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`download failed ${res.status} ${url} ${detail.slice(0, 200)}`);
  }
  await mkdir(path.dirname(destination), { recursive: true });
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destination));
}

async function downloadCurl(url, headers, destination) {
  await mkdir(path.dirname(destination), { recursive: true });
  const args = [
    "-L",
    "--fail",
    "--silent",
    "--show-error",
    "--retry",
    "5",
    "--retry-all-errors",
    "--retry-delay",
    "2",
    "--connect-timeout",
    "30",
    "--max-time",
    "1800",
    "-A",
    "Mozilla/5.0",
  ];
  let headerFile = null;
  try {
    for (const [name, value] of Object.entries(headers)) {
      if (name.toLowerCase() === "authorization") {
        headerFile = path.join(os.tmpdir(), `dev-academy-curl-${randomUUID()}.hdr`);
        await writeFile(headerFile, `${name}: ${value}\n`, { mode: 0o600 });
        args.push("-H", `@${headerFile}`);
      } else {
        args.push("-H", `${name}: ${value}`);
      }
    }
    args.push("-o", destination, url);
    await new Promise((resolve, reject) => {
      const child = spawn(process.env.CURL_BIN || DEFAULT_CURL, args, {
        windowsHide: true,
      });
      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr = `${stderr}${chunk}`.slice(-1000);
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`curl failed ${code} ${stderr.slice(0, 300)}`));
      });
    });
  } finally {
    if (headerFile) await rm(headerFile, { force: true });
  }
}

async function shouldReuse(destination, expectedSize) {
  if (process.env.BACKUP_RESUME !== "1" || !Number.isFinite(expectedSize)) {
    return false;
  }
  const info = await stat(destination).catch(() => null);
  return Boolean(info && info.size === expectedSize);
}

function allocateStoredPath(used, originalPath) {
  const key = originalPath.toLowerCase();
  if (!used.has(key)) {
    used.set(key, originalPath);
    return originalPath;
  }
  let index = 1;
  while (true) {
    const candidate = `_casefold/${String(index).padStart(4, "0")}/${originalPath}`;
    if (!used.has(candidate.toLowerCase())) {
      used.set(candidate.toLowerCase(), candidate);
      return candidate;
    }
    index += 1;
  }
}

async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function runner() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runner())
  );
  return results;
}

async function listSupabaseObjects(bucket, prefix = "") {
  const result = [];
  let offset = 0;
  while (true) {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/list/${bucket}`,
      {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prefix,
          limit: 1000,
          offset,
          sortBy: { column: "name", order: "asc" },
        }),
      }
    );
    if (!res.ok) {
      throw new Error(`storage list failed ${res.status} for ${prefix}`);
    }
    const rows = await res.json();
    for (const row of rows) {
      const fullPath = prefix ? `${prefix}/${row.name}` : row.name;
      if (row.id === null) {
        result.push(...(await listSupabaseObjects(bucket, fullPath)));
      } else {
        result.push({ path: fullPath, size: row.metadata?.size ?? null });
      }
    }
    if (rows.length < 1000) break;
    offset += rows.length;
  }
  return result;
}

async function backupSupabaseMedia(staging, records) {
  const destRoot = path.join(staging, "supabase-media");
  const used = new Map();
  const objects = await listSupabaseObjects("media");
  logLine(`supabase media objects=${objects.length}`);
  const jobs = objects.map((object) => ({
    ...object,
    storedPath: allocateStoredPath(used, object.path),
  }));
  const concurrency = Math.max(1, Number(process.env.BACKUP_MEDIA_CONCURRENCY) || 6);
  const results = await runPool(jobs, concurrency, async (object) => {
    const destination = safeJoin(destRoot, object.storedPath);
    const url = `${process.env.SUPABASE_URL}/storage/v1/object/authenticated/media/${encodePath(object.path)}`;
    if (!(await shouldReuse(destination, Number(object.size)))) {
      await download(
        url,
        {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        destination
      );
    }
    const info = await stat(destination);
    const digest = await hashFile(destination);
    return {
      path: object.path,
      storedPath: object.storedPath,
      size: info.size,
      digest,
    };
  });
  results.sort((left, right) => left.path.localeCompare(right.path));
  const inventory = results.map(
    (row) => `${row.path}\t${row.storedPath}\t${row.size}\t${row.digest}`
  );
  const inventoryText = `${inventory.join("\n")}${inventory.length ? "\n" : ""}`;
  await writeFile(path.join(staging, "media-inventory.tsv"), inventoryText);
  const casefold = results
    .filter((row) => row.storedPath.startsWith("_casefold/"))
    .map((row) => `${row.storedPath}\t${row.path}`);
  await writeFile(
    path.join(staging, "media-casefold.tsv"),
    `${casefold.join("\n")}${casefold.length ? "\n" : ""}`
  );
  records.media = {
    count: results.length,
    bytes: results.reduce((sum, row) => sum + row.size, 0),
  };
}

async function listHfFiles() {
  const repo = `${process.env.HF_USER}/${process.env.HF_REPO}`;
  const res = await fetch(
    `https://huggingface.co/api/datasets/${repo}/tree/main?recursive=true`,
    { headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` } }
  );
  if (!res.ok) {
    throw new Error(`HF tree failed ${res.status}`);
  }
  const rows = await res.json();
  return {
    repo,
    files: rows.filter((row) => row.type === "file"),
  };
}

async function backupHfInventory(staging, records) {
  const { repo, files } = await listHfFiles();
  logLine(`HF dataset inventory-only objects=${files.length} repo=${repo}`);
  const rows = files.map((file) => `${file.path}\t${file.size ?? ""}\t${file.oid ?? ""}`);
  await writeFile(
    path.join(staging, "hf-inventory.tsv"),
    `${rows.join("\n")}${rows.length ? "\n" : ""}`
  );
  records.hf = {
    count: files.length,
    bytes: files.reduce((sum, file) => sum + Number(file.size || 0), 0),
    included: false,
    repo,
  };
}

async function backupHfDataset(staging, records) {
  const destRoot = path.join(staging, "hf-dataset");
  const used = new Map();
  const { repo, files } = await listHfFiles();
  logLine(`HF dataset objects=${files.length} repo=${repo}`);
  const jobs = files.map((file) => ({
    ...file,
    storedPath: allocateStoredPath(used, file.path),
  }));
  const hfConcurrency = Math.max(1, Number(process.env.BACKUP_HF_CONCURRENCY) || 6);
  const results = await runPool(jobs, hfConcurrency, async (file) => {
    const destination = safeJoin(destRoot, file.storedPath);
    const url = `https://huggingface.co/datasets/${repo}/resolve/main/${encodePath(file.path)}?download=true`;
    if (!(await shouldReuse(destination, Number(file.size)))) {
      await downloadCurl(url, { Authorization: `Bearer ${process.env.HF_TOKEN}` }, destination);
    }
    const info = await stat(destination);
    const digest = await hashFile(destination);
    return {
      path: file.path,
      storedPath: file.storedPath,
      size: info.size,
      digest,
    };
  });
  results.sort((left, right) => left.path.localeCompare(right.path));
  const inventory = results.map(
    (row) => `${row.path}\t${row.storedPath}\t${row.size}\t${row.digest}`
  );
  const inventoryText = `${inventory.join("\n")}${inventory.length ? "\n" : ""}`;
  await writeFile(path.join(staging, "hf-inventory.tsv"), inventoryText);
  records.hf = {
    count: results.length,
    bytes: results.reduce((sum, row) => sum + row.size, 0),
  };
}

async function dumpDatabase(staging, records) {
  const dumpPath = path.join(staging, "dev-academy.dump");
  const args = [
    "--host",
    process.env.SUPABASE_DB_HOST || `db.${process.env.SUPABASE_PROJECT_REF}.supabase.co`,
    "--port",
    process.env.SUPABASE_DB_PORT || "5432",
    "--username",
    process.env.SUPABASE_DB_USER || "postgres",
    "--dbname",
    "postgres",
    "--schema=public",
    "--schema=auth",
    "--schema=storage",
    "--format=custom",
    "--no-owner",
    "--no-publications",
    "--no-subscriptions",
    "--no-password",
    "--file",
    dumpPath,
  ];
  const result = spawnSync(process.env.PG_DUMP_BIN || DEFAULT_PG_DUMP, args, {
    env: { ...process.env, PGPASSWORD: process.env.SUPABASE_DB_PASSWORD },
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`pg_dump failed: ${result.stderr?.slice(0, 500)}`);
  }
  const info = await stat(dumpPath);
  records.database = { bytes: info.size };
}

async function createArchive(staging, stamp, log) {
  const archivePath = path.join(BACKUP_ROOT, `dev-academy-${stamp}.7z`);
  const password = process.env.BACKUP_ARCHIVE_PASSWORD;
  if (!password) throw new Error("BACKUP_ARCHIVE_PASSWORD is missing");
  const result = spawnSync(
    process.env.SEVEN_ZIP_BIN || DEFAULT_7ZR,
    [
      "a",
      "-y",
      "-t7z",
      "-mx=3",
      "-mhe=on",
      `-p${password}`,
      archivePath,
      staging,
    ],
    { encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(`7zr failed: ${result.stderr?.slice(0, 500)}`);
  }
  const info = await stat(archivePath);
  const digest = await hashFile(archivePath);
  await writeFile(`${archivePath}.sha256`, `${digest}  ${path.basename(archivePath)}\n`);
  log(`archive bytes=${info.size} sha256=${digest}`);
  return { archivePath, digest, bytes: info.size };
}

async function copyOffsite(archivePath, stamp, digest, log) {
  const destinationRoot = process.env.ONEDRIVE_BACKUP_DIR || DEFAULT_ONEDRIVE;
  const destinationDir = path.join(destinationRoot, stamp);
  await mkdir(destinationDir, { recursive: true });
  const destination = path.join(destinationDir, path.basename(archivePath));
  await copyFile(archivePath, destination);
  await copyFile(`${archivePath}.sha256`, `${destination}.sha256`);
  const sourceInfo = await stat(archivePath);
  const destinationInfo = await stat(destination);
  if (sourceInfo.size !== destinationInfo.size) {
    throw new Error("offsite copy size mismatch");
  }
  const destinationDigest = await hashFile(destination);
  if (destinationDigest !== digest) {
    throw new Error("offsite copy hash mismatch");
  }
  log(`offsite copy verified ${destination}`);
}

async function pruneOld(folder, log) {
  const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
  const cutoff = Date.now() - RETENTION_DAYS * 86400000;
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^\d{8}_\d{6}$/.test(entry.name)) continue;
    const fullPath = path.join(folder, entry.name);
    const info = await stat(fullPath);
    if (info.mtimeMs < cutoff) {
      await rm(fullPath, { recursive: true, force: true });
      log(`pruned ${fullPath}`);
    }
  }
}

async function main() {
  const env = loadEnv(await readFile(path.join(ROOT, ".env"), "utf8"));
  process.env = { ...process.env, ...env };
  const required = [
    "SUPABASE_URL",
    "SUPABASE_PROJECT_REF",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_DB_PASSWORD",
    "HF_USER",
    "HF_REPO",
    "HF_TOKEN",
    "BACKUP_ARCHIVE_PASSWORD",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`missing env: ${missing.join(", ")}`);

  const stamp =
    process.env.BACKUP_STAMP ||
    new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace("T", "_")
      .slice(0, 15);
  const staging = path.join(BACKUP_ROOT, stamp);
  await mkdir(staging, { recursive: true });
  const records = { stamp, startedAt: new Date().toISOString(), media: null, hf: null, database: null };
  const lines = [];
  const log = (message) => lines.push(logLine(message));

  try {
    log("backup started");
    await dumpDatabase(staging, records);
    log(`database bytes=${records.database.bytes}`);
    await backupSupabaseMedia(staging, records);
    log(`supabase media bytes=${records.media.bytes}`);
    if (process.env.BACKUP_INCLUDE_HF === "0") {
      await backupHfInventory(staging, records);
      log(`HF dataset inventory-only objects=${records.hf.count} bytes=${records.hf.bytes}`);
    } else {
      await backupHfDataset(staging, records);
      log(`HF dataset bytes=${records.hf.bytes}`);
    }
    await writeFile(
      path.join(staging, "backup-manifest.json"),
      `${JSON.stringify(records, null, 2)}\n`
    );
    await writeFile(path.join(staging, "backup.log"), `${lines.join("\n")}\n`);
    const archive = await createArchive(staging, stamp, log);
    await writeFile(
      path.join(staging, "backup.log"),
      `${lines.join("\n")}\n`
    );
    await copyOffsite(archive.archivePath, stamp, archive.digest, log);
    await pruneOld(BACKUP_ROOT, log);
    await pruneOld(process.env.ONEDRIVE_BACKUP_DIR || DEFAULT_ONEDRIVE, log);
    log("backup completed");
    await writeFile(path.join(staging, "backup.log"), `${lines.join("\n")}\n`);
  } catch (error) {
    log(`backup failed: ${error.stack || error.message}`);
    await writeFile(path.join(staging, "backup.log"), `${lines.join("\n")}\n`).catch(
      () => {}
    );
    process.exitCode = 1;
  }
}

await main();
