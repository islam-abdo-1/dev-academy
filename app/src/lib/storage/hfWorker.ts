import { supabase } from "@/lib/supabase";

export const MAX_HF_FILE_BYTES = 90 * 1024 * 1024;

export interface HfUploadResult {
  url: string;
  path: string;
  provider: "huggingface";
  size: number;
}

export interface HfUploadOptions {
  onProgress?: (percentage: number) => void;
  signal?: AbortSignal;
}

export interface StorageUsage {
  globalUsedBytes: number;
  globalLimitBytes: number;
  globalReservedBytes: number;
  userUsedBytes: number;
  userLimitBytes: number;
  userReservedBytes: number;
  monthlyUploadedBytes: number;
  monthlyLimitBytes: number;
  maxFileBytes: number;
  monthKey: string;
}

function workerBaseUrl(): string {
  const url = (import.meta.env.VITE_HF_UPLOAD_WORKER_URL || "").trim();
  if (!url) {
    throw new Error(
      "خدمة رفع الملفات غير مهيأة. أضف VITE_HF_UPLOAD_WORKER_URL ثم أعد المحاولة.",
    );
  }
  return url.replace(/\/+$/, "");
}

export function isHfUploadConfigured(): boolean {
  return Boolean((import.meta.env.VITE_HF_UPLOAD_WORKER_URL || "").trim());
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("انتهت الجلسة. سجل الدخول من جديد ثم أعد المحاولة.");
  return { Authorization: `Bearer ${token}` };
}

function parseWorkerError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body);
    if (parsed?.error) return String(parsed.error);
  } catch {
    // Use the raw response below.
  }
  if (status === 413) return "حجم الملف يتجاوز الحد المسموح (90MB).";
  if (status === 401 || status === 403) return "غير مصرح برفع الملف.";
  if (status === 507) return "لا توجد مساحة كافية في التخزين.";
  return body || `فشل رفع الملف (${status}).`;
}

export async function uploadStudyFile(
  file: File,
  options: HfUploadOptions = {},
): Promise<HfUploadResult> {
  if (file.size > MAX_HF_FILE_BYTES) {
    throw new Error("حجم الملف يتجاوز الحد الأقصى 90MB.");
  }

  const headers = await authHeaders();
  const url = `${workerBaseUrl()}/upload`;

  return new Promise<HfUploadResult>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.timeout = 600000;
    request.setRequestHeader("Authorization", headers.Authorization);
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.setRequestHeader("X-File-Name", encodeURIComponent(file.name));

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || !options.onProgress) return;
      options.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };

    request.onload = () => {
      const body = request.responseText || "";
      if (request.status >= 200 && request.status < 300) {
        try {
          const result = JSON.parse(body) as HfUploadResult;
          if (!result?.url || !result?.path) {
            reject(new Error("استجابة رفع غير صالحة."));
            return;
          }
          resolve(result);
        } catch {
          reject(new Error("استجابة رفع غير صالحة."));
        }
        return;
      }
      reject(new Error(parseWorkerError(request.status, body)));
    };

    request.onerror = () => reject(new Error("تعذر الاتصال بخدمة الرفع."));
    request.ontimeout = () => reject(new Error("انتهت مهلة رفع الملف."));
    request.onabort = () => reject(new Error("تم إلغاء رفع الملف."));

    if (options.signal) {
      if (options.signal.aborted) {
        request.abort();
        return;
      }
      options.signal.addEventListener("abort", () => request.abort(), { once: true });
    }

    request.send(file);
  });
}

export async function deleteStudyFile(path: string): Promise<number> {
  if (!path) return 0;
  const headers = await authHeaders();
  const response = await fetch(`${workerBaseUrl()}/delete`, {
    method: "DELETE",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(parseWorkerError(response.status, body));
  }
  try {
    const result = JSON.parse(body);
    return Number(result?.releasedBytes) || 0;
  } catch {
    return 0;
  }
}

export async function getStorageUsage(): Promise<StorageUsage | null> {
  const { data, error } = await supabase.rpc("get_storage_usage");
  if (error) throw error;
  if (!data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    globalUsedBytes: Number(row.globalUsedBytes ?? row.global_used_bytes ?? 0),
    globalLimitBytes: Number(row.globalLimitBytes ?? row.global_limit_bytes ?? 0),
    globalReservedBytes: Number(row.globalReservedBytes ?? row.global_reserved_bytes ?? 0),
    userUsedBytes: Number(row.userUsedBytes ?? row.user_used_bytes ?? 0),
    userLimitBytes: Number(row.userLimitBytes ?? row.user_limit_bytes ?? 0),
    userReservedBytes: Number(row.userReservedBytes ?? row.user_reserved_bytes ?? 0),
    monthlyUploadedBytes: Number(row.monthlyUploadedBytes ?? row.monthly_uploaded_bytes ?? 0),
    monthlyLimitBytes: Number(row.monthlyLimitBytes ?? row.monthly_limit_bytes ?? 0),
    maxFileBytes: Number(row.maxFileBytes ?? row.max_file_bytes ?? 0),
    monthKey: String(row.monthKey ?? row.month_key ?? ""),
  };
}
