import { createRemoteJWKSet, jwtVerify } from "jose";
import { renderMessageEmail } from "../_lib/email-template";

interface Env {
  EMAIL_PROVIDER?: string;
  RESEND_API_KEY?: string;
  BREVO_API_KEY?: string;
  GMAIL_CLIENT_ID?: string;
  GMAIL_CLIENT_SECRET?: string;
  GMAIL_REFRESH_TOKEN?: string;
  EMAIL_FROM?: string;
  SITE_URL?: string;
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

interface CallerProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  disabled: boolean | null;
}

interface MessageRow {
  id: string;
  to_email: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body: string | null;
  created_date: string;
  broadcast_id: string | null;
}

interface RecipientProfile {
  email: string;
  full_name: string | null;
  disabled: boolean | null;
}

interface DeliveryRow {
  message_id: string;
  status: string;
  attempts: number;
  updated_date: string;
}

interface SendResult {
  messageId: string;
  status: "sent" | "failed" | "skipped";
  providerId?: string;
  error?: string;
  persist?: boolean;
  attempts?: number;
}

interface BatchEmail {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  reply_to: string;
}

const DEFAULT_SUPABASE_URL = "https://uytyvnoqhqivvhujdxoc.supabase.co";
const DEFAULT_SITE_URL = "https://dev-academy.pages.dev";
const DEFAULT_EMAIL_FROM = "Dev Academy <islam230366qw@gmail.com>";
const MAX_BATCH = 50;
const MAX_ATTEMPTS = 3;
const STALE_SENDING_MS = 10 * 60 * 1000;
const BREVO_CONCURRENCY = 5;
// Gmail allows ~250 quota units/second per user and messages.send costs 100.
// Two workers with a short pause stay under that ceiling.
const GMAIL_CONCURRENCY = 2;
const GMAIL_SEND_PAUSE_MS = 600;

type EmailProvider = "resend" | "brevo" | "gmail";
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
let gmailTokenCache: { token: string; expiresAt: number } | null = null;

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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
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
      "Cache-Control": "no-store",
      ...corsHeaders(env, request),
    },
  });
}

function supabaseBase(env: Env): string {
  return (env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, "");
}

function siteUrl(env: Env): string {
  return (env.SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

function emailFrom(env: Env): string {
  return env.EMAIL_FROM || DEFAULT_EMAIL_FROM;
}

function emailProvider(env: Env): EmailProvider {
  const value = (env.EMAIL_PROVIDER || "").trim().toLowerCase();
  if (value === "brevo" || value === "resend" || value === "gmail") {
    return value;
  }
  if (
    env.GMAIL_REFRESH_TOKEN &&
    !env.BREVO_API_KEY &&
    !env.RESEND_API_KEY
  ) {
    return "gmail";
  }
  if (env.BREVO_API_KEY && !env.RESEND_API_KEY) return "brevo";
  return "resend";
}

function parseSender(value: string): { email: string; name?: string } {
  const match = value.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  if (match) {
    const email = match[2].trim();
    const name = match[1].trim();
    return name ? { email, name } : { email };
  }
  return { email: value.trim() };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(Math.max(limit, 1), items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        output[index] = await worker(items[index], index);
      }
    },
  );
  await Promise.all(runners);
  return output;
}

interface BrevoResult {
  providerId?: string;
  error?: string;
}

async function sendBrevoEmail(
  env: Env,
  email: BatchEmail,
  messageId: string,
  sender: { email: string; name?: string },
): Promise<BrevoResult> {
  const replyTo = parseSender(email.reply_to);
  const payload: Record<string, unknown> = {
    sender,
    to: [{ email: email.to[0] }],
    subject: email.subject,
    htmlContent: email.html,
    textContent: email.text,
    replyTo,
    headers: { "X-Mailin-custom": JSON.stringify({ messageId }) },
  };
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": env.BREVO_API_KEY || "",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error("brevo send failed", response.status, text.slice(0, 500));
    return { error: cleanError(text || `email provider error ${response.status}`) };
  }
  let providerId = "";
  try {
    const parsed = text ? (JSON.parse(text) as { messageId?: string }) : {};
    providerId = String(parsed.messageId || "");
  } catch {
    providerId = "";
  }
  return { providerId };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function base64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function encodeMimeHeader(value: string): string {
  const singleLine = value.replace(/[\r\n]+/g, " ").trim();
  if (/^[\x20-\x7e]*$/.test(singleLine)) return singleLine;
  return `=?UTF-8?B?${base64Utf8(singleLine)}?=`;
}

function buildGmailRaw(email: BatchEmail): string {
  const boundary = `devacademy-${crypto.randomUUID()}`;
  const headers = [
    `From: ${encodeMimeHeader(email.from)}`,
    `To: ${email.to.map(encodeMimeHeader).join(", ")}`,
    `Reply-To: ${encodeMimeHeader(email.reply_to)}`,
    `Subject: ${encodeMimeHeader(email.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Utf8(email.text),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Utf8(email.html),
    `--${boundary}--`,
    "",
  ];
  const mime = `${headers.join("\r\n")}\r\n\r\n${body.join("\r\n")}`;
  return base64Utf8(mime)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function googleErrorMessage(text: string): string {
  try {
    const parsed = JSON.parse(text) as {
      error?: { message?: string; status?: string };
    };
    const message = parsed.error?.message || parsed.error?.status;
    if (message) return message;
  } catch {
    // fall through to raw text
  }
  return text;
}

async function getGmailAccessToken(env: Env): Promise<string> {
  if (gmailTokenCache && gmailTokenCache.expiresAt > Date.now() + 60_000) {
    return gmailTokenCache.token;
  }
  if (
    !env.GMAIL_CLIENT_ID ||
    !env.GMAIL_CLIENT_SECRET ||
    !env.GMAIL_REFRESH_TOKEN
  ) {
    throw new Error("gmail oauth credentials are not configured");
  }
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      refresh_token: env.GMAIL_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error("gmail token refresh failed", response.status, text.slice(0, 300));
    throw new Error("gmail oauth token refresh failed");
  }
  const parsed = JSON.parse(text) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!parsed.access_token) throw new Error("gmail oauth returned no token");
  const ttl = Math.max(Number(parsed.expires_in) || 3600, 120);
  gmailTokenCache = {
    token: parsed.access_token,
    expiresAt: Date.now() + (ttl - 60) * 1000,
  };
  return parsed.access_token;
}

async function sendGmailEmail(
  email: BatchEmail,
  accessToken: string,
): Promise<BrevoResult> {
  const raw = buildGmailRaw(email);
  let lastError = "email provider error";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ raw }),
      },
    );
    const text = await response.text();
    if (response.ok) {
      let providerId = "";
      try {
        const parsed = text ? (JSON.parse(text) as { id?: string }) : {};
        providerId = String(parsed.id || "");
      } catch {
        providerId = "";
      }
      return { providerId };
    }
    lastError = cleanError(
      googleErrorMessage(text) || `gmail error ${response.status}`,
    );
    if (response.status === 429 || response.status >= 500) {
      await sleep(1000 * (attempt + 1));
      continue;
    }
    console.error("gmail send failed", response.status, text.slice(0, 500));
    return { error: lastError };
  }
  console.error("gmail send exhausted retries", lastError);
  return { error: lastError };
}

async function restAsService<T>(
  env: Env,
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(500, "SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  const response = await fetch(`${supabaseBase(env)}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("supabase rest failed", response.status, detail.slice(0, 300));
    throw new HttpError(502, "database request failed");
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

function quoteList(values: string[]): string {
  return values.map((value) => encodeURIComponent(value)).join(",");
}

function cleanError(value: unknown): string {
  const text = String(value ?? "email provider error")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 500) || "email provider error";
}

function isValidMessageId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}

function normalizeEmail(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function patchDelivery(
  env: Env,
  messageId: string,
  row: Record<string, unknown>,
): Promise<void> {
  await restAsService(
    env,
    `message_email_deliveries?message_id=eq.${encodeURIComponent(messageId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(row),
    },
  );
}

async function upsertDeliveries(
  env: Env,
  rows: Array<{
    message_id: string;
    status: "sending" | "sent" | "failed" | "skipped";
    attempts: number;
    error: string | null;
    sent_at: string | null;
    updated_date: string;
  }>,
): Promise<void> {
  if (rows.length === 0) return;
  await restAsService(
    env,
    "message_email_deliveries?on_conflict=message_id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    },
  );
}

async function loadCaller(env: Env, userId: string): Promise<CallerProfile> {
  const rows = await restAsService<CallerProfile[]>(
    env,
    `profiles?id=eq.${encodeURIComponent(userId)}&select=id,email,full_name,role,disabled&limit=1`,
  );
  const caller = rows?.[0];
  if (!caller) throw new HttpError(403, "profile not found");
  if (caller.disabled) throw new HttpError(403, "account is disabled");
  if (caller.role !== "admin" && caller.role !== "super_admin") {
    throw new HttpError(403, "staff access required");
  }
  if (!caller.email) throw new HttpError(403, "profile has no email");
  return caller;
}

async function handleSend(env: Env, request: Request): Promise<Response> {
  const provider = emailProvider(env);
  if (provider === "resend" && !env.RESEND_API_KEY) {
    throw new HttpError(
      503,
      "email service is not configured yet (RESEND_API_KEY is missing)",
    );
  }
  if (provider === "brevo" && !env.BREVO_API_KEY) {
    throw new HttpError(
      503,
      "email service is not configured yet (BREVO_API_KEY is missing)",
    );
  }
  if (
    provider === "gmail" &&
    (!env.GMAIL_CLIENT_ID ||
      !env.GMAIL_CLIENT_SECRET ||
      !env.GMAIL_REFRESH_TOKEN)
  ) {
    throw new HttpError(
      503,
      "email service is not configured yet (Gmail OAuth credentials are missing)",
    );
  }

  const user = await verifyUser(env, request);
  const caller = await loadCaller(env, user.id);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new HttpError(400, "invalid JSON body");
  }
  if (!payload || typeof payload !== "object") {
    throw new HttpError(400, "invalid body");
  }

  const body = payload as {
    messageIds?: unknown;
    broadcastId?: unknown;
    offset?: unknown;
  };

  const messageIds = Array.isArray(body.messageIds)
    ? [...new Set(body.messageIds.filter(isValidMessageId))].slice(0, MAX_BATCH)
    : [];
  const broadcastId =
    typeof body.broadcastId === "string" &&
    /^[0-9a-f-]{36}$/i.test(body.broadcastId)
      ? body.broadcastId
      : "";
  const offset =
    Number.isInteger(body.offset) && Number(body.offset) >= 0
      ? Math.min(Number(body.offset), 100000)
      : 0;

  if ((messageIds.length > 0) === Boolean(broadcastId)) {
    throw new HttpError(400, "send either messageIds or broadcastId");
  }

  let messages: MessageRow[] = [];
  if (messageIds.length > 0) {
    messages =
      (await restAsService<MessageRow[]>(
        env,
        `messages?id=in.(${quoteList(messageIds)})&select=id,to_email,from_email,from_name,subject,body,created_date,broadcast_id&limit=${MAX_BATCH}`,
      )) || [];
  } else {
    messages =
      (await restAsService<MessageRow[]>(
        env,
        `messages?broadcast_id=eq.${encodeURIComponent(broadcastId)}&select=id,to_email,from_email,from_name,subject,body,created_date,broadcast_id&order=created_date.asc,id.asc&limit=${MAX_BATCH}&offset=${offset}`,
      )) || [];
  }

  if (messages.length === 0) {
    return json(
      {
        requested: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        processed: 0,
        hasMore: false,
        results: [],
      },
      200,
      env,
      request,
    );
  }

  const callerEmail = normalizeEmail(caller.email);
  const unauthorized = messages.find(
    (message) => normalizeEmail(message.from_email) !== callerEmail,
  );
  if (unauthorized) {
    throw new HttpError(403, "you can only send your own messages");
  }

  const deliveryRows =
    (await restAsService<DeliveryRow[]>(
      env,
      `message_email_deliveries?message_id=in.(${quoteList(
        messages.map((message) => message.id),
      )})&select=message_id,status,attempts,updated_date`,
    )) || [];
  const deliveryByMessage = new Map(
    deliveryRows.map((row) => [row.message_id, row]),
  );

  const recipientEmails = [
    ...new Set(messages.map((message) => normalizeEmail(message.to_email))),
  ].filter(Boolean);
  const recipientRows =
    recipientEmails.length > 0
      ? (await restAsService<RecipientProfile[]>(
          env,
          `profiles?email=in.(${quoteList(recipientEmails)})&select=email,full_name,disabled`,
        )) || []
      : [];
  const recipientByEmail = new Map(
    recipientRows.map((row) => [normalizeEmail(row.email), row]),
  );

  const results: SendResult[] = [];
  const queue: Array<{
    message: MessageRow;
    recipient: RecipientProfile;
    attempt: number;
  }> = [];

  for (const message of messages) {
    const delivery = deliveryByMessage.get(message.id);
    const attempt = Number(delivery?.attempts) || 0;
    if (delivery?.status === "sent") {
      results.push({
        messageId: message.id,
        status: "skipped",
        error: "already sent",
      });
      continue;
    }
    if (attempt >= MAX_ATTEMPTS) {
      results.push({
        messageId: message.id,
        status: "skipped",
        error: "attempt limit reached",
        persist: true,
        attempts: attempt,
      });
      continue;
    }
    if (delivery?.status === "sending") {
      const updated = new Date(delivery.updated_date).getTime();
      if (Number.isFinite(updated) && Date.now() - updated < STALE_SENDING_MS) {
        results.push({
          messageId: message.id,
          status: "skipped",
          error: "already sending",
        });
        continue;
      }
    }

    const recipientEmail = normalizeEmail(message.to_email);
    const recipient = recipientByEmail.get(recipientEmail);
    if (!recipient || recipient.disabled) {
      results.push({
        messageId: message.id,
        status: "skipped",
        error: !recipient ? "recipient not found" : "recipient is disabled",
        persist: true,
        attempts: attempt,
      });
      continue;
    }
    if (!message.subject?.trim() || !message.body?.trim()) {
      results.push({
        messageId: message.id,
        status: "skipped",
        error: "message has no subject or body",
        persist: true,
        attempts: attempt,
      });
      continue;
    }

    queue.push({
      message,
      recipient,
      attempt: attempt + 1,
    });
  }

  const skippedRows = results
    .filter((result) => result.status === "skipped" && result.persist)
    .map((result) => ({
      message_id: result.messageId,
      status: "skipped" as const,
      attempts: result.attempts || 0,
      error: result.error || "skipped",
      sent_at: null,
      updated_date: new Date().toISOString(),
    }));
  const persistSkipped = () =>
    skippedRows.length > 0 ? upsertDeliveries(env, skippedRows) : Promise.resolve();

  if (queue.length === 0) {
    await persistSkipped();
    const skipped = results.filter((result) => result.status === "skipped");
    return json(
      {
        requested: messages.length,
        sent: 0,
        failed: 0,
        skipped: skipped.length,
        processed: messages.length,
        hasMore: broadcastId ? messages.length === MAX_BATCH : false,
        results,
      },
      200,
      env,
      request,
    );
  }

  const now = new Date().toISOString();
  try {
    await upsertDeliveries(
      env,
      queue.map((item) => ({
        message_id: item.message.id,
        status: "sending",
        attempts: item.attempt,
        error: null,
        sent_at: null,
        updated_date: now,
      })),
    );
  } catch (error) {
    console.error("failed to mark deliveries as sending", error);
    throw new HttpError(502, "could not prepare email delivery");
  }

  const emails: BatchEmail[] = queue.map(({ message, recipient }) => {
    const rendered = renderMessageEmail({
      subject: message.subject || "رسالة من Dev Academy",
      body: message.body || "",
      senderName: message.from_name || caller.full_name || "فريق Dev Academy",
      senderEmail: message.from_email,
      recipientName: recipient.full_name,
      createdAt: message.created_date,
      siteUrl: siteUrl(env),
      isBroadcast: Boolean(message.broadcast_id),
    });
    return {
      from: emailFrom(env),
      to: [message.to_email],
      subject: (message.subject || "رسالة من Dev Academy").replace(/[\r\n]+/g, " ").slice(0, 200),
      html: rendered.html,
      text: rendered.text,
      reply_to: message.from_email,
    };
  });

  const providerIds: Array<string | null> = new Array(queue.length).fill(null);
  const providerErrors: Array<string | null> = new Array(queue.length).fill(null);

  if (provider === "resend") {
    const idempotencyKey = `devacademy-${(
      await sha256Hex(queue.map((item) => item.message.id).sort().join(","))
    ).slice(0, 48)}`;

    try {
      const response = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(emails),
      });
      const text = await response.text();
      if (!response.ok) {
        console.error("resend batch failed", response.status, text.slice(0, 500));
        throw new HttpError(502, "email provider rejected the request");
      }
      const parsed = text ? (JSON.parse(text) as { data?: Array<{ id?: string }> }) : {};
      const ids = Array.isArray(parsed.data)
        ? parsed.data.map((item) => String(item?.id || ""))
        : [];
      queue.forEach((_, index) => {
        providerIds[index] = ids[index] || null;
      });
    } catch (error) {
      console.error("resend request failed", error);
      const message =
        error instanceof HttpError ? error.message : "email provider unreachable";
      await Promise.allSettled(
        queue.map((item) =>
          patchDelivery(env, item.message.id, {
            status: "failed",
            error: cleanError(message),
            updated_date: new Date().toISOString(),
          }),
        ),
      );
      throw new HttpError(502, message);
    }
  } else if (provider === "gmail") {
    let accessToken: string;
    try {
      accessToken = await getGmailAccessToken(env);
    } catch (error) {
      console.error("gmail access token failed", error);
      const message =
        error instanceof Error ? error.message : "gmail authentication failed";
      await Promise.allSettled(
        queue.map((item) =>
          patchDelivery(env, item.message.id, {
            status: "failed",
            error: cleanError(message),
            updated_date: new Date().toISOString(),
          }),
        ),
      );
      throw new HttpError(502, "could not authenticate with Gmail");
    }
    const outcome = await mapWithConcurrency(
      queue,
      GMAIL_CONCURRENCY,
      async (item, index) => {
        try {
          return await sendGmailEmail(emails[index], accessToken);
        } catch (error) {
          console.error("gmail request failed", error);
          return { error: "email provider unreachable" };
        } finally {
          await sleep(GMAIL_SEND_PAUSE_MS);
        }
      },
    );
    outcome.forEach((item, index) => {
      providerIds[index] = item.providerId || null;
      providerErrors[index] = item.error || null;
    });
  } else {
    const sender = parseSender(emailFrom(env));
    const outcome = await mapWithConcurrency(
      queue,
      BREVO_CONCURRENCY,
      async (item, index) => {
        try {
          return await sendBrevoEmail(
            env,
            emails[index],
            item.message.id,
            sender,
          );
        } catch (error) {
          console.error("brevo request failed", error);
          return { error: "email provider unreachable" };
        }
      },
    );
    outcome.forEach((item, index) => {
      providerIds[index] = item.providerId || null;
      providerErrors[index] = item.error || null;
    });
  }

  const updateJobs: Promise<void>[] = [];
  const sentAt = new Date().toISOString();
  queue.forEach((item, index) => {
    const providerId = providerIds[index];
    if (!providerId) {
      const result: SendResult = {
        messageId: item.message.id,
        status: "failed",
        error: providerErrors[index] || "email provider returned no id",
      };
      results.push(result);
      updateJobs.push(
        patchDelivery(env, item.message.id, {
          status: "failed",
          error: result.error,
          updated_date: sentAt,
        }),
      );
      return;
    }
    const result: SendResult = {
      messageId: item.message.id,
      status: "sent",
      providerId,
    };
    results.push(result);
    updateJobs.push(
      patchDelivery(env, item.message.id, {
        status: "sent",
        provider_id: providerId,
        error: null,
        sent_at: sentAt,
        updated_date: sentAt,
      }),
    );
  });

  await Promise.allSettled([persistSkipped(), ...updateJobs]);

  const sent = results.filter((result) => result.status === "sent").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const skipped = results.filter((result) => result.status === "skipped").length;

  return json(
    {
      requested: messages.length,
      sent,
      failed,
      skipped,
      processed: messages.length,
      hasMore: broadcastId ? messages.length === MAX_BATCH : false,
      results,
    },
    200,
    env,
    request,
  );
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
    if (request.method !== "POST") {
      return json({ error: "method not allowed" }, 405, env, request);
    }
    return await handleSend(env, request);
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.message }, error.status, env, request);
    }
    console.error("send message email failed", error);
    return json({ error: "could not send email" }, 500, env, request);
  }
}
