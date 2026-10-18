#!/usr/bin/env node
/**
 * Import the Base44 export into Supabase:
 *   1. users   -> auth.users (admin API) + profiles
 *   2. files   -> storage bucket "media" (rewrites file URLs)
 *   3. data    -> subjects/chapters/lectures/... tables
 *
 * Usage (from the project root):
 *   node scripts/import-supabase.mjs                 # all three phases
 *   node scripts/import-supabase.mjs --skip-users
 *   node scripts/import-supabase.mjs --skip-files
 *   node scripts/import-supabase.mjs --skip-data
 *   node scripts/import-supabase.mjs --export-dir=exports/base44-...
 *
 * Requires .env in the project root:
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Idempotent: re-running upserts everything.
 */

import { readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUCKET = "media";

const argv = process.argv.slice(2);
const skipUsers = argv.includes("--skip-users");
const skipFiles = argv.includes("--skip-files");
const skipData = argv.includes("--skip-data");
const exportDirArg = argv.find((a) => a.startsWith("--export-dir="));
const onlyTestUsers = argv.includes("--include-test-users");

const FILE_DIR_BY_ENTITY = {
  LectureItem: "lectures",
  SectionItem: "sections",
  Resource: "resources",
};

const MIME_BY_EXT = {
  ".pdf": "application/pdf",
  ".html": "text/html",
  ".htm": "text/html",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".ipynb": "application/json",
  ".zip": "application/zip",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const TABLE_ORDER = [
  "subjects",
  "chapters",
  "lectures",
  "sections",
  "lecture_items",
  "section_items",
  "resources",
  "favorites",
  "subject_views",
  "activity_logs",
  "messages",
  "announcements",
];

const ENTITY_FILE_BY_TABLE = {
  subjects: "Subject.json",
  chapters: "Chapter.json",
  lectures: "Lecture.json",
  sections: "Section.json",
  lecture_items: "LectureItem.json",
  section_items: "SectionItem.json",
  resources: "Resource.json",
  favorites: "Favorite.json",
  subject_views: "SubjectView.json",
  activity_logs: "ActivityLog.json",
  messages: "Message.json",
  announcements: "Announcement.json",
};

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

function normalizeDate(value) {
  if (typeof value !== "string" || !value) return value;
  // Base44 entity dates come without a timezone ("...T15:54:41.694000");
  // pin them to UTC so the import is deterministic.
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(value)) return value;
  return `${value}Z`;
}

async function pickExportDir() {
  if (exportDirArg) {
    const dir = path.resolve(ROOT, exportDirArg.slice("--export-dir=".length));
    if (!existsSync(path.join(dir, "manifest.json"))) {
      throw new Error(`No manifest.json in ${dir}`);
    }
    return dir;
  }
  const exportsRoot = path.join(ROOT, "exports");
  const dirs = (await readdir(exportsRoot, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && d.name.startsWith("base44-"))
    .map((d) => d.name)
    .sort();
  if (dirs.length === 0) throw new Error("No exports/base44-* directory found");
  return path.join(exportsRoot, dirs[dirs.length - 1]);
}

async function main() {
  const envText = await readFile(path.join(ROOT, ".env"), "utf8");
  const env = loadEnv(envText);
  const baseUrl = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  const exportDir = await pickExportDir();
  console.log(`Importing from ${path.relative(ROOT, exportDir)}`);
  const manifest = JSON.parse(
    await readFile(path.join(exportDir, "manifest.json"), "utf8")
  );

  const urlMap = new Map();

  // ---------------------------------------------------------------
  // 1. Users
  // ---------------------------------------------------------------
  const usersPath = path.join(exportDir, "_Users.json");
  let users = [];
  if (existsSync(usersPath)) {
    users = JSON.parse(await readFile(usersPath, "utf8"));
  }

  const authUsersByEmail = new Map();
  if (!skipUsers) {
    console.log("\n== Users ==");
    const listRes = await fetch(
      `${baseUrl}/auth/v1/admin/users?page=1&per_page=1000`,
      { headers }
    );
    if (listRes.ok) {
      const body = await listRes.json();
      for (const u of body.users ?? []) {
        authUsersByEmail.set((u.email ?? "").toLowerCase(), u);
      }
    }

    for (const u of users) {
      const email = (u.email ?? "").toLowerCase();
      if (!email) continue;
      if (!onlyTestUsers && /@example\.com$/.test(email)) {
        console.log(`  skip test account ${email}`);
        continue;
      }

      let authUser = authUsersByEmail.get(email);
      if (!authUser) {
        const createRes = await fetch(`${baseUrl}/auth/v1/admin/users`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            email: u.email,
            email_confirm: true,
            user_metadata: {
              full_name: u.full_name ?? undefined,
              avatar_url: u.avatar_url ?? undefined,
              imported_from: "base44",
            },
          }),
        });
        if (!createRes.ok) {
          const text = await createRes.text();
          console.error(`  FAILED to create ${email}: ${createRes.status} ${text}`);
          continue;
        }
        authUser = await createRes.json();
        authUsersByEmail.set(email, authUser);
        console.log(`  created auth user ${email}`);
      } else {
        console.log(`  auth user exists ${email}`);
      }

      // profile row (created by the auth trigger) -> fill in legacy fields
      const profile = {
        legacy_id: u.id ?? null,
        email: u.email,
        full_name: u.full_name ?? null,
        role: u.role ?? "user",
        major: u.major ?? null,
        year: u.year ?? null,
        semester: u.semester ?? null,
        avatar_url: u.avatar_url ?? null,
        disabled: Boolean(u.disabled),
        disabled_reason: u.disabled_reason ?? null,
        created_date: normalizeDate(u.created_date) ?? undefined,
      };
      const patchRes = await fetch(
        `${baseUrl}/rest/v1/profiles?id=eq.${authUser.id}`,
        {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify(profile),
        }
      );
      if (!patchRes.ok && patchRes.status !== 204) {
        console.error(
          `  profile update failed for ${email}: ${patchRes.status} ${await patchRes.text()}`
        );
      }

      // stash mapping for later (avatar uploads use raw user id)
      u._auth_user_id = authUser.id;
    }
  }

  // ---------------------------------------------------------------
  // 2. Files -> storage
  // ---------------------------------------------------------------
  if (!skipFiles) {
    console.log("\n== Files ==");
    const byUrl = manifest.files?.byUrl ?? {};
    for (const [originalUrl, relPath] of Object.entries(byUrl)) {
      const rel = relPath.split(/[\\/]/);
      const entity = rel[1];
      const recordId = rel[2];
      const filename = rel[rel.length - 1];
      const dirName = FILE_DIR_BY_ENTITY[entity] ?? entity.toLowerCase();
      const storagePath = `${dirName}/${recordId}/${filename}`;
      const localPath = path.join(exportDir, relPath);

      const bytes = await readFile(localPath);
      const ext = path.extname(filename).toLowerCase();
      const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";

      const upRes = await fetch(
        `${baseUrl}/storage/v1/object/${BUCKET}/${storagePath}`,
        {
          method: "POST",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": contentType,
            "x-upsert": "true",
          },
          body: bytes,
        }
      );
      if (!upRes.ok) {
        console.error(
          `  upload failed ${storagePath}: ${upRes.status} ${await upRes.text()}`
        );
        continue;
      }
      const publicUrl = `${baseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;
      urlMap.set(originalUrl, publicUrl);
      console.log(`  uploaded ${storagePath}`);
    }

    // avatars
    for (const u of users) {
      if (!u.avatar_url) continue;
      if (!onlyTestUsers && /@example\.com$/.test(u.email ?? "")) continue;
      let ext = "";
      try {
        ext = path.extname(new URL(u.avatar_url).pathname) || ".jpg";
      } catch {
        continue;
      }
      const storagePath = `avatars/${u._auth_user_id ?? u.id}${ext}`;
      try {
        const dl = await fetch(u.avatar_url);
        if (!dl.ok) throw new Error(`download ${dl.status}`);
        const bytes = Buffer.from(await dl.arrayBuffer());
        const contentType = MIME_BY_EXT[ext.toLowerCase()] ?? "application/octet-stream";
        const upRes = await fetch(
          `${baseUrl}/storage/v1/object/${BUCKET}/${storagePath}`,
          {
            method: "POST",
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": contentType,
              "x-upsert": "true",
            },
            body: bytes,
          }
        );
        if (!upRes.ok) throw new Error(`upload ${upRes.status}`);
        const publicUrl = `${baseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;
        urlMap.set(u.avatar_url, publicUrl);
        if (u._auth_user_id) {
          await fetch(`${baseUrl}/rest/v1/profiles?id=eq.${u._auth_user_id}`, {
            method: "PATCH",
            headers: { ...headers, Prefer: "return=minimal" },
            body: JSON.stringify({ avatar_url: publicUrl }),
          });
        }
        console.log(`  uploaded avatar for ${u.email}`);
      } catch (err) {
        console.error(`  avatar failed for ${u.email}: ${err.message}`);
      }
    }
  }

  // ---------------------------------------------------------------
  // 3. Data tables
  // ---------------------------------------------------------------
  if (!skipData) {
    console.log("\n== Data ==");
    for (const table of TABLE_ORDER) {
      const file = ENTITY_FILE_BY_TABLE[table];
      const filePath = path.join(exportDir, file);
      if (!existsSync(filePath)) {
        console.log(`  ${table}: no file, skipped`);
        continue;
      }
      const rows = JSON.parse(await readFile(filePath, "utf8"));
      if (!Array.isArray(rows) || rows.length === 0) {
        console.log(`  ${table}: 0 rows`);
        continue;
      }

      const cleaned = rows.map((row) => {
        const out = { ...row };
        for (const key of Object.keys(out)) {
          if (/_date$/.test(key)) out[key] = normalizeDate(out[key]);
          if (key === "url" && out[key] && urlMap.has(out[key])) {
            out[key] = urlMap.get(out[key]);
          }
        }
        // favorites imported from Base44 have no user_id in Supabase terms
        if (table === "favorites" && !out.user_id) delete out.user_id;
        return out;
      });

      // PostgREST requires every object in one request to have identical
      // keys. Base44 rows are ragged (optional fields are simply absent),
      // so group rows by their key signature and send one request per group.
      const groups = new Map();
      for (const row of cleaned) {
        const sig = Object.keys(row).sort().join("|");
        if (!groups.has(sig)) groups.set(sig, []);
        groups.get(sig).push(row);
      }

      let imported = 0;
      for (const group of groups.values()) {
        const BATCH = 200;
        for (let i = 0; i < group.length; i += BATCH) {
          const batch = group.slice(i, i + BATCH);
          const res = await fetch(
            `${baseUrl}/rest/v1/${table}?on_conflict=id`,
            {
              method: "POST",
              headers: {
                ...headers,
                Prefer: "resolution=merge-duplicates,return=minimal",
              },
              body: JSON.stringify(batch),
            }
          );
          if (!res.ok) {
            console.error(
              `  ${table}: batch failed ${res.status} ${await res.text()}`
            );
            break;
          }
          imported += batch.length;
        }
      }
      console.log(`  ${table}: ${imported}/${rows.length} rows`);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(`\nImport failed: ${err.message}`);
  process.exit(1);
});
