import { AwsClient } from "aws4fetch";
import { createRemoteJWKSet, jwtVerify } from "jose";

interface Env {
  HF_ACCESS_KEY_ID: string;
  HF_SECRET_ACCESS_KEY: string;
  HF_NAMESPACE: string;
  HF_BUCKET: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ALLOWED_ORIGINS?: string;
}

interface AuthUser {
  id: string;
  token: string;
}

interface ReservedUpload {
  reservationId: string;
  path: string;
  bytes: number;
}

const MAX_FILE_BYTES = 90 * 1024 * 1024;
const RESERVATION_TTL_MINUTES = 20;
const ALLOWED_EXTENSIONS = new Set([
  "pdf", "png", "jpg", "jpeg", "webp", "gif", "html", "htm",
  "docx", "doc", "pptx", "ppt", "xlsx", "xls", "zip", "rar", "7z",
  "mp4", "webm", "mp3", "wav", "m4a", "py", "txt", "md", "csv", "json",
]);
const BLOCKED_EXTENSIONS = new Set(["eml", "msg", "mbox", "pst", "ost"]);
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function corsHeaders(env: Env, request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!origin || (!allowed.includes("*") && !allowed.includes(origin))) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, HEAD, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-File-Name, Range",
    "Access-Control-Expose-Headers": "Content-Length, Content-Range, Content-Type, Accept-Ranges",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function assertOrigin(env: Env, request: Request): void {
  const origin = request.headers.get("Origin");
  if (!origin) return;
  const allowed = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!allowed.includes("*") && !allowed.includes(origin)) {
    throw new HttpError(403, "origin is not allowed");
  }
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
  const value = (env.SUPABASE_URL || "").replace(/\/+$/, "");
  if (!value) throw new HttpError(500, "SUPABASE_URL is not configured");
  return value;
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
    return { id: verified.payload.sub, token };
  } catch (error) {
    if (error instanceof HttpError) throw error;
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
  return { id: user.id, token };
}

function parseRpcError(status: number, body: string): HttpError {
  let message = body;
  try {
    const parsed = JSON.parse(body);
    if (parsed?.message) message = String(parsed.message);
  } catch {
    // Keep the raw body.
  }
  const normalized = message.toLowerCase();
  if (normalized.includes("rate limit")) {
    return new HttpError(429, "طلبات كثيرة جداً. حاول مرة أخرى بعد قليل.");
  }
  if (normalized.includes("monthly upload limit")) {
    return new HttpError(429, "تم الوصول للحد الشهري للرفع.");
  }
  if (normalized.includes("per-file") || normalized.includes("file exceeds")) {
    return new HttpError(413, "حجم الملف يتجاوز الحد المسموح.");
  }
  if (normalized.includes("quota") || normalized.includes("exceeded")) {
    return new HttpError(507, "لا توجد مساحة كافية في التخزين.");
  }
  if (status === 401 || status === 403) {
    return new HttpError(401, "غير مصرح برفع الملف.");
  }
  return new HttpError(502, "تعذر تحديث حصة التخزين.");
}

async function rpc(
  env: Env,
  token: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(`${supabaseBase(env)}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await response.text();
  if (!response.ok) throw parseRpcError(response.status, text);
  if (!text) return null;
  return JSON.parse(text);
}

async function rpcAsService(
  env: Env,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(500, "SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  const response = await fetch(`${supabaseBase(env)}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await response.text();
  if (!response.ok) throw parseRpcError(response.status, text);
  if (!text) return null;
  return JSON.parse(text);
}

async function restAsService<T>(
  env: Env,
  path: string,
): Promise<T | null> {
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

async function reserveUpload(
  env: Env,
  user: AuthUser,
  path: string,
  bytes: number,
): Promise<string> {
  const data = await rpcAsService(env, "service_reserve_storage", {
    p_user_id: user.id,
    p_bytes: bytes,
    p_path: path,
    p_provider: "huggingface",
  });
  const value =
    typeof data === "string"
      ? data
      : Array.isArray(data)
        ? data[0]
        : (data as { reserve_storage?: string } | null)?.reserve_storage;
  if (typeof value !== "string" || !value) {
    throw new HttpError(502, "تعذر حجز مساحة للرفع.");
  }
  return value;
}

async function confirmUpload(
  env: Env,
  user: AuthUser,
  reservationId: string,
  bytes: number,
): Promise<void> {
  await rpcAsService(env, "service_confirm_storage", {
    p_user_id: user.id,
    p_reservation_id: reservationId,
    p_actual_bytes: bytes,
  });
}

async function releaseUpload(
  env: Env,
  user: AuthUser,
  reservationId: string,
): Promise<void> {
  try {
    await rpcAsService(env, "service_release_storage", {
      p_user_id: user.id,
      p_reservation_id: reservationId,
    });
  } catch (error) {
    console.error("Failed to release storage reservation", error);
  }
}

function sanitizeFileName(value: string): string {
  const decoded = (() => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  })();
  const cleaned = decoded
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120);
  return cleaned || "file";
}

function fileExtension(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

function uploadPath(userId: string, fileName: string): string {
  return `${userId}/${crypto.randomUUID()}_${fileName}`;
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

function isOwnedObjectPath(userId: string, key: string): boolean {
  if (!key || key.length > 400 || key.includes("\\") || key.includes("\0")) {
    return false;
  }
  const segments = key.split("/");
  if (segments.length !== 2 || segments[0] !== userId) return false;
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

function hfObjectUrl(env: Env, key: string): string {
  return `https://s3.hf.co/${encodeURIComponent(env.HF_NAMESPACE)}/${encodeURIComponent(env.HF_BUCKET)}/${encodeKey(key)}`;
}

function workerFileUrl(request: Request, key: string): string {
  return new URL(`/file/${encodeKey(key)}`, request.url).toString();
}

function hfClient(env: Env): AwsClient {
  return new AwsClient({
    accessKeyId: env.HF_ACCESS_KEY_ID,
    secretAccessKey: env.HF_SECRET_ACCESS_KEY,
    service: "s3",
    region: "us-east-1",
  });
}

async function putHfObject(
  env: Env,
  key: string,
  body: ReadableStream<Uint8Array>,
  contentType: string,
): Promise<void> {
  const signed = await hfClient(env).sign(hfObjectUrl(env, key), {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body,
  });
  const response = await fetch(signed);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("HF upload failed", response.status, text.slice(0, 500));
    throw new HttpError(502, "تعذر رفع الملف إلى التخزين.");
  }
  await response.body?.cancel();
}

async function deleteHfObject(env: Env, key: string): Promise<void> {
  const signed = await hfClient(env).sign(hfObjectUrl(env, key), {
    method: "DELETE",
  });
  const response = await fetch(signed);
  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => "");
    console.error("HF delete failed", response.status, text.slice(0, 500));
    throw new HttpError(502, "تعذر حذف الملف من التخزين.");
  }
  await response.body?.cancel();
}

function countedStream(
  body: ReadableStream<Uint8Array>,
  limit: number,
  counter: { bytes: number },
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await reader.read();
        if (next.done) {
          controller.close();
          return;
        }
        counter.bytes += next.value.byteLength;
        if (counter.bytes > limit) {
          controller.error(new HttpError(413, "حجم الملف يتجاوز الحد المسموح."));
          await reader.cancel();
          return;
        }
        controller.enqueue(next.value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

async function handleUpload(
  env: Env,
  request: Request,
): Promise<Response> {
  const user = await verifyUser(env, request);
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (!Number.isFinite(declared) || declared <= 0) {
    throw new HttpError(411, "Content-Length is required.");
  }
  if (declared > MAX_FILE_BYTES) {
    throw new HttpError(413, "حجم الملف يتجاوز الحد الأقصى 90MB.");
  }
  if (!request.body) throw new HttpError(400, "request body is required");

  const fileName = sanitizeFileName(
    request.headers.get("X-File-Name") || "file",
  );
  const extension = fileExtension(fileName);
  if (!ALLOWED_EXTENSIONS.has(extension) || BLOCKED_EXTENSIONS.has(extension)) {
    throw new HttpError(415, "نوع الملف غير مسموح.");
  }
  const contentType =
    (request.headers.get("Content-Type") || "application/octet-stream")
      .split(";")[0]
      .trim() || "application/octet-stream";

  const path = uploadPath(user.id, fileName);
  const reservationId = await reserveUpload(env, user, path, declared);
  const counter = { bytes: 0 };

  try {
    await putHfObject(
      env,
      path,
      countedStream(request.body, MAX_FILE_BYTES, counter),
      contentType,
    );
    if (counter.bytes !== declared) {
      throw new HttpError(400, "Uploaded size did not match Content-Length.");
    }
    await confirmUpload(env, user, reservationId, counter.bytes);
  } catch (error) {
    await releaseUpload(env, user, reservationId);
    await deleteHfObject(env, path).catch((deleteError) => {
      console.error("Failed to clean up after upload error", deleteError);
    });
    throw error;
  }

  return json(
    {
      url: workerFileUrl(request, path),
      path,
      provider: "huggingface",
      size: counter.bytes,
    },
    200,
    env,
    request,
  );
}

async function handleDelete(
  env: Env,
  request: Request,
): Promise<Response> {
  const user = await verifyUser(env, request);
  let payload: { path?: string };
  try {
    payload = (await request.json()) as { path?: string };
  } catch {
    throw new HttpError(400, "invalid JSON body");
  }
  const path = (payload.path || "").trim();
  if (!isOwnedObjectPath(user.id, path)) {
    throw new HttpError(403, "object path is not owned by the user");
  }

  await deleteHfObject(env, path);

  const data = await rpcAsService(env, "service_remove_storage_object", {
    p_user_id: user.id,
    p_path: path,
  });
  const releasedBytes =
    typeof data === "number" ? data : Number(data ?? 0) || 0;

  return json({ path, releasedBytes }, 200, env, request);
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

function filePathFromUrl(url: URL): string | null {
  const prefix = "/file/";
  if (!url.pathname.startsWith(prefix)) return null;
  const encoded = url.pathname.slice(prefix.length);
  if (!encoded) return null;
  try {
    return encoded.split("/").map(decodeURIComponent).join("/");
  } catch {
    return null;
  }
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

    if (active && token && token.resource_type === "file" && token.resource_id === file.id) {
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

async function handleFile(
  env: Env,
  request: Request,
): Promise<Response> {
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
  const sourceName = (
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      assertOrigin(env, request);

      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: corsHeaders(env, request),
        });
      }

      const url = new URL(request.url);
      if (url.pathname === "/health" && request.method === "GET") {
        return json({ ok: true }, 200, env, request);
      }
      if (url.pathname === "/upload" && request.method === "POST") {
        return await handleUpload(env, request);
      }
      if (url.pathname === "/delete" && request.method === "DELETE") {
        return await handleDelete(env, request);
      }
      if (
        url.pathname.startsWith("/file/") &&
        (request.method === "GET" || request.method === "HEAD")
      ) {
        return await handleFile(env, request);
      }

      return json({ error: "not found" }, 404, env, request);
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: error.message }, error.status, env, request);
      }
      console.error("Unhandled worker error", error);
      return json(
        { error: "حدث خطأ غير متوقع في خدمة الرفع." },
        500,
        env,
        request,
      );
    }
  },
};

