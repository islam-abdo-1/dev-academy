import { supabase } from "./supabase";

export interface EmailSendResult {
  requested: number;
  sent: number;
  failed: number;
  skipped: number;
  processed: number;
  hasMore: boolean;
  results: Array<{
    messageId: string;
    status: "sent" | "failed" | "skipped";
    providerId?: string;
    error?: string;
  }>;
}

export interface BroadcastEmailProgress {
  sent: number;
  failed: number;
  skipped: number;
  processed: number;
  total: number;
}

async function authToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("الجلسة انتهت، سجّل الدخول مرة أخرى");
  return token;
}

export async function sendMessageEmails(input: {
  messageIds?: string[];
  broadcastId?: string;
  offset?: number;
}): Promise<EmailSendResult> {
  const token = await authToken();
  const response = await fetch("/api/send-message-email", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: unknown }).error || "")
        : "";
    throw new Error(message || "تعذر إرسال البريد الإلكتروني");
  }

  const result = payload as Partial<EmailSendResult> | null;
  return {
    requested: Number(result?.requested) || 0,
    sent: Number(result?.sent) || 0,
    failed: Number(result?.failed) || 0,
    skipped: Number(result?.skipped) || 0,
    processed: Number(result?.processed) || 0,
    hasMore: Boolean(result?.hasMore),
    results: Array.isArray(result?.results) ? result.results : [],
  };
}

export async function sendBroadcastEmails(
  broadcastId: string,
  onProgress?: (progress: BroadcastEmailProgress) => void,
): Promise<BroadcastEmailProgress> {
  const totals: BroadcastEmailProgress = {
    sent: 0,
    failed: 0,
    skipped: 0,
    processed: 0,
    total: 0,
  };
  let offset = 0;

  for (let page = 0; page < 100; page += 1) {
    const result = await sendMessageEmails({ broadcastId, offset });
    totals.sent += result.sent;
    totals.failed += result.failed;
    totals.skipped += result.skipped;
    totals.processed += result.processed;
    totals.total += result.requested;
    onProgress?.({ ...totals });

    if (!result.hasMore || result.processed === 0) break;
    offset += result.processed;
  }

  return totals;
}
