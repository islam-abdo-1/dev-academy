import { createClient } from "@supabase/supabase-js";

const READ_TIMEOUT_MS = 10000;
const WRITE_TIMEOUT_MS = 120000;

function fetchWithTimeout(input, init = {}) {
  if (init?.signal) return fetch(input, init);
  const method = (init?.method || "GET").toUpperCase();
  const timeout =
    method === "GET" || method === "HEAD" ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { global: { fetch: fetchWithTimeout } },
);
