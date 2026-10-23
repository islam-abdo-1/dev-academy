import { AwsClient } from "aws4fetch";
import { createRemoteJWKSet, jwtVerify } from "jose";

interface Env {
  HF_ACCESS_KEY_ID: string;
  HF_SECRET_ACCESS_KEY: string;
  HF_NAMESPACE?: string;
  HF_BUCKET?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ALLOWED_ORIGINS?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

interface AuthUser {
  id: string;
}

interface PersonalFileRow {
  id: string;
  user_id: string;
  is_public: boolean;
  title: string | null;
}

interface ShareTokenRow {
  resource_type: string;
  resource_id: string;
  permission: string;
  expires_at: string | null;
}

interface StorageObjectRow {
  user_id: string;
}

const PREFIX = "/api/hf-file/";
const DEFAULT_SUPABASE_URL = "https://uytyvnoqhqivvhujdxoc.supabase.co";
const DEFAULT_HF_NAMESPACE = "devacademy-fcai";
const DEFAULT_HF_BUCKET = "devacademy-media";
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function corsHeaders(env: Env, request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  if (!origin) return {};
  const allowed = allowedOrigins(env);
  if (!allowed.includes("*") && !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Range",
    "Access-Control-Expose-Headers":
      "Content-Length, Content-Range, Content-Type, Accept-Ranges, Content-Disposition",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(
  data: unknown,
  status: number,
  env: Env,
  request: Request,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(env, request),
    },
  });
}

function supabaseBase(env: Env): string {
  return (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, "");
}

function hfNamespace(env: Env): string {
  return env.HF_NAMESPACE || DEFAULT_HF_NAMESPACE;
}

function hfBucket(env: Env): string {
  return env.HF_BUCKET || DEFAULT_HF_BUCKET;
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

function hfObjectUrl(env: Env, key: string): string {
  return `https://s3.hf.co/${encodeURIComponent(hfNamespace(env))}/${encodeURIComponent(hfBucket(env))}/${encodeKey(key)}`;
}

function hfClient(env: Env): AwsClient {
  return new AwsClient({
    accessKeyId: env.HF_ACCESS_KEY_ID,
    secretAccessKey: env.HF_SECRET_ACCESS_KEY,
    service: "s3",
    region: "us-east-1",
  });
}

async function restAsService<T>(env: Env, path: string): Promise<T | null> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(500, "SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  const response = await fetch(`${supabaseBase(env)}/rest/v1/${path}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!response.ok) {
    throw new HttpError(502, "storage metadata lookup failed");
  }
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text) as T;
}

async function verifyUser(env: Env, request: Request): Promise<AuthUser> {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new HttpError(401, "missing bearer token");

  const base = supabaseBase(env);
  try {
    let jwks = jwksCache.get(base);
    if (!jwks) {
      jwks = createRemoteJWKSet(
        new URL(`${base}/auth/v1/.well-known/jwks.json`),
      );
      jwksCache.set(base, jwks);
    }
    const verified = await jwtVerify(token, jwks, {
      issuer: `${base}/auth/v1`,
      audience: "authenticated",
    });
    if (!verified.payload.sub) {
      throw new HttpError(401, "token has no subject");
    }
    return { id: verified.payload.sub };
  } catch (error) {
    if (error instanceof HttpError) throw error;
  }

  if (!env.SUPABASE_ANON_KEY) {
    throw new HttpError(401, "invalid session");
  }

  const response = await fetch(`${base}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new HttpError(401, "invalid session");
  const user = (await response.json()) as { id?: string };
  if (!user.id) throw new HttpError(401, "invalid session");
  return { id: user.id };
}

function filePathFromUrl(url: URL): string | null {
  if (!url.pathname.startsWith(PREFIX)) return null;
  const encoded = url.pathname.slice(PREFIX.length);
  if (!encoded) return null;
  try {
    return encoded.split("/").map(decodeURIComponent).join("/");
  } catch {
    return null;
  }
}

function isOwnedObjectPath(ownerId: string, key: string): boolean {
  if (!key || key.length > 400 || key.includes("\\") || key.includes("\0")) {
    return false;
  }
  const segments = key.split("/");
  if (segments.length !== 2 || segments[0] !== ownerId) return false;
  const name = segments[1];
  return (
    name.length > 0 &&
    name.length <= 200 &&
    name !== "." &&
    name !== ".." &&
    /^[A-Za-z0-9._-]+$/.test(name) &&
    !name.startsWith(".")
  );
}

async function canReadPersonalFile(
  env: Env,
  request: Request,
  url: URL,
  file: PersonalFileRow,
): Promise<void> {
  if (file.is_public) return;

  const share = (url.searchParams.get("share") || "").trim();
  if (share.length >= 16 && share.length <= 128) {
    const rows = await restAsService<ShareTokenRow[]>(
      env,
      `share_tokens?token=eq.${encodeURIComponent(share)}&select=resource_type,resource_id,permission,expires_at&limit=1`,
    );
    const token = rows?.[0];
    const active = Boolean(
      token &&
        (!token.expires_at || new Date(token.expires_at).getTime() > Date.now()),
    );

    if (
      active &&
      token &&
      token.resource_type === "file" &&
      token.resource_id === file.id
    ) {
      return;
    }

    if (active && token && token.resource_type === "list") {
      const items = await restAsService<{ id: string }[]>(
        env,
        `user_saved_items?list_id=eq.${encodeURIComponent(token.resource_id)}&personal_file_id=eq.${encodeURIComponent(file.id)}&select=id&limit=1`,
      );
      if (items?.[0]) return;
    }
  }

  const hasBearer = (request.headers.get("Authorization") || "")
    .toLowerCase()
    .startsWith("bearer ");
  if (!hasBearer) throw new HttpError(404, "file not found");

  const user = await verifyUser(env, request);
  if (user.id !== file.user_id) {
    throw new HttpError(404, "file not found");
  }
}

async function handleFile(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = filePathFromUrl(url);
  if (!path) throw new HttpError(404, "not found");

  const ownerId = path.split("/")[0];
  if (!/^[0-9a-f-]{36}$/i.test(ownerId) || !isOwnedObjectPath(ownerId, path)) {
    throw new HttpError(404, "not found");
  }

  const rows = await restAsService<PersonalFileRow[]>(
    env,
    `user_personal_files?storage_path=eq.${encodeURIComponent(path)}&select=id,user_id,is_public,title&limit=1`,
  );
  const personal = rows?.[0] ?? null;
  if (personal) {
    await canReadPersonalFile(env, request, url, personal);
  } else {
    const objects = await restAsService<StorageObjectRow[]>(
      env,
      `storage_objects?object_path=eq.${encodeURIComponent(path)}&select=user_id&limit=1`,
    );
    const owner = objects?.[0]?.user_id;
    if (owner) {
      const hasBearer = (request.headers.get("Authorization") || "")
        .toLowerCase()
        .startsWith("bearer ");
      if (!hasBearer) throw new HttpError(404, "file not found");
      const user = await verifyUser(env, request);
      if (user.id !== owner) throw new HttpError(404, "file not found");
    }
  }

  const range = request.headers.get("Range");
  const signed = await hfClient(env).sign(hfObjectUrl(env, path), {
    method: request.method === "HEAD" ? "HEAD" : "GET",
    headers: range ? { Range: range } : {},
  });
  const response = await fetch(signed);

  if (response.status === 404 || response.status === 403) {
    await response.body?.cancel();
    throw new HttpError(404, "file not found");
  }
  if (response.status === 416) {
    await response.body?.cancel();
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Type": "application/octet-stream",
        ...corsHeaders(env, request),
      },
    });
  }
  if (!response.ok && response.status !== 206) {
    await response.body?.cancel();
    throw new HttpError(502, "failed to read stored file");
  }

  const headers = new Headers();
  for (const name of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
    "last-modified",
  ]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }

  const download = url.searchParams.has("download");
  const sourceName =
    (
      personal?.title ||
      path.split("/").pop() ||
      "file"
    )
      .replace(/[\r\n"]/g, "")
      .trim() || "file";
  const asciiName = sourceName.replace(/[^\x20-\x7E]/g, "_") || "file";
  const encodedName = encodeURIComponent(sourceName);
  headers.set(
    "Content-Disposition",
    `${download ? "attachment" : "inline"}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
  );
  headers.set(
    "Cache-Control",
    personal && !personal.is_public
      ? "private, max-age=0, must-revalidate"
      : "public, max-age=3600",
  );
  headers.set("X-Content-Type-Options", "nosniff");
  for (const [name, value] of Object.entries(corsHeaders(env, request))) {
    headers.set(name, value);
  }

  return new Response(request.method === "HEAD" ? null : response.body, {
    status: response.status,
    headers,
  });
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(env, request),
      });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "method not allowed" }, 405, env, request);
    }
    return await handleFile(env, request);
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.message }, error.status, env, request);
    }
    console.error("Unhandled file proxy error", error);
    return json({ error: "فشل غير متوقع في خدمة الملفات." }, 500, env, request);
  }
}
