import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_ORIGINS = ["https://dev-academy.pages.dev", "http://localhost:5173"];

function allowedOrigin(req: Request): string | null {
  const origin = req.headers.get("Origin");
  if (!origin) return null;
  const configured = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return [...DEFAULT_ORIGINS, ...configured].includes(origin) ? origin : null;
}

function corsHeaders(req: Request) {
  const origin = allowedOrigin(req);
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

const ALLOWED_ROLES = ["user", "admin", "doctor", "assistant"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, { error: "method not allowed" }, 405);
  }
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigin(req)) {
    return json(req, { error: "origin not allowed" }, 403);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return json(req, { error: "missing authorization" }, 401);
  }

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    return json(req, { error: "invalid token" }, 401);
  }

  const { data: caller } = await admin
    .from("profiles")
    .select("role, disabled")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (!caller || caller.disabled || caller.role !== "super_admin") {
    return json(req, { error: "forbidden: super admin only" }, 403);
  }

  let payload: { email?: string; role?: string };
  try {
    payload = await req.json();
  } catch {
    return json(req, { error: "invalid json" }, 400);
  }

  const email = String(payload.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json(req, { error: "invalid email" }, 400);
  }
  const role = ALLOWED_ROLES.includes(String(payload.role))
    ? String(payload.role)
    : "user";

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    return json(req, { error: "email_already_registered", email }, 409);
  }

  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email);

  if (inviteError) {
    const message = String(inviteError.message || "").toLowerCase();
    if (
      message.includes("already") ||
      message.includes("exists") ||
      message.includes("registered")
    ) {
      return json(req, { error: "email_already_registered", email }, 409);
    }
    return json(req, { error: inviteError.message }, 400);
  }

  if (invited?.user) {
    const { error: profileError } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", invited.user.id);
    if (profileError) {
      return json(req, { ok: true, email, role, warning: profileError.message });
    }
  }

  return json(req, { ok: true, email, role });
});
