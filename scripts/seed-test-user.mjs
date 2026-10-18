#!/usr/bin/env node
/**
 * Dev-only helper: create (or refresh) a test account that can log in
 * while real users still need Google sign-in / password reset.
 *
 * Usage: node scripts/seed-test-user.mjs
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

async function main() {
  const env = loadEnv(await readFile(path.join(ROOT, ".env"), "utf8"));
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN } = env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_PROJECT_REF || !SUPABASE_ACCESS_TOKEN) {
    throw new Error("Missing SUPABASE_* variables in .env");
  }

  const TEST_USER = {
    email: env.SEED_USER_EMAIL,
    password: env.SEED_USER_PASSWORD,
    full_name: env.SEED_USER_NAME || "Dev Admin",
    role: env.SEED_USER_ROLE || "super_admin",
    major: env.SEED_USER_MAJOR || "ai",
    year: env.SEED_USER_YEAR || "year-1",
    semester: env.SEED_USER_SEMESTER || "sem-1",
  };
  if (!TEST_USER.email || !TEST_USER.password) {
    throw new Error("Missing SEED_USER_EMAIL / SEED_USER_PASSWORD in .env");
  }

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password,
      email_confirm: true,
      user_metadata: { full_name: TEST_USER.full_name },
    }),
  });
  const body = await res.text();
  if (res.ok) {
    console.log("Auth user created.");
  } else if (res.status === 422 || body.toLowerCase().includes("already")) {
    console.log("Auth user already exists.");
  } else {
    throw new Error(`Auth admin create failed (${res.status}): ${body}`);
  }

  const esc = (v) => String(v).replace(/'/g, "''");
  const sql = `
    update public.profiles set
      full_name = '${esc(TEST_USER.full_name)}',
      role = '${esc(TEST_USER.role)}',
      major = '${esc(TEST_USER.major)}',
      year = '${esc(TEST_USER.year)}',
      semester = '${esc(TEST_USER.semester)}',
      disabled = false
    where email = '${esc(TEST_USER.email)}';`;

  const qres = await fetch(`${API_BASE}/projects/${SUPABASE_PROJECT_REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!qres.ok) {
    throw new Error(`Profile update failed (${qres.status}): ${await qres.text()}`);
  }
  console.log("Profile ready. Login with:", TEST_USER.email);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
