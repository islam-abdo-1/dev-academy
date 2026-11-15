const PROXY_PREFIX = "/api/hf-file";

function workerBase(): URL | null {
  const raw = (import.meta.env.VITE_HF_UPLOAD_WORKER_URL || "").trim();
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function proxyBase(): URL | null {
  const raw = (import.meta.env.VITE_HF_FILE_PROXY_BASE || "").trim();
  if (!raw && !import.meta.env.PROD) return null;
  if (typeof window === "undefined") return null;
  try {
    return new URL(raw || PROXY_PREFIX, window.location.origin);
  } catch {
    return null;
  }
}

function isWorkerUploadUrl(value: string): boolean {
  const base = workerBase();
  if (!base) return false;
  try {
    const url = new URL(value);
    return (
      url.origin === base.origin &&
      url.pathname.startsWith("/file/") &&
      url.pathname.length > "/file/".length
    );
  } catch {
    return false;
  }
}

function isProxyUrl(value: string): boolean {
  const base = proxyBase();
  if (!base) return false;
  try {
    const url = new URL(value);
    const basePath = base.pathname.replace(/\/+$/, "");
    return (
      url.origin === base.origin &&
      url.pathname.startsWith(`${basePath}/`) &&
      url.pathname.length > basePath.length + 1
    );
  } catch {
    return false;
  }
}

export function isWorkerFileUrl(value?: string | null): boolean {
  const raw = (value || "").trim();
  if (!raw) return false;
  return isWorkerUploadUrl(raw) || isProxyUrl(raw);
}

export function proxiedFileUrl(path: string): string | null {
  const key = (path || "").trim().replace(/^\/+/, "");
  const base = proxyBase();
  if (!key || !base) return null;
  const encoded = key.split("/").map(encodeURIComponent).join("/");
  const url = new URL(base.toString());
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/${encoded}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

/**
 * Converts legacy direct Worker file links (`/file/<path>`) to the
 * authenticated Pages proxy (`/api/hf-file/<path>`).
 */
export function normalizeWorkerFileUrl(value?: string | null): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  const base = workerBase();
  if (!base) return raw;
  try {
    const url = new URL(raw);
    if (url.origin !== base.origin || !url.pathname.startsWith("/file/")) {
      return raw;
    }
    const encoded = url.pathname.slice("/file/".length);
    if (!encoded) return raw;
    let path: string;
    try {
      path = encoded.split("/").map(decodeURIComponent).join("/");
    } catch {
      return raw;
    }
    const proxied = proxiedFileUrl(path);
    if (!proxied) return raw;
    const share = url.searchParams.get("share");
    if (share) {
      const next = new URL(proxied);
      next.searchParams.set("share", share);
      return next.toString();
    }
    return proxied;
  } catch {
    return raw;
  }
}

export function withWorkerShareToken(
  value: string | null | undefined,
  token: string,
): string {
  const raw = (value || "").trim();
  if (!raw || !token || !isWorkerFileUrl(raw)) return raw;
  try {
    const url = new URL(raw);
    url.searchParams.set("share", token);
    return url.toString();
  } catch {
    return raw;
  }
}
