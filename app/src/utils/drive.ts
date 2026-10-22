export type DriveKind = "file" | "folder" | "doc" | "sheet" | "slides";

export interface ParsedDriveUrl {
  id: string;
  kind: DriveKind;
}

export interface DriveMeta {
  name: string;
  mimeType: string;
}

const DOC_KINDS: Record<string, DriveKind> = {
  document: "doc",
  spreadsheets: "sheet",
  presentation: "slides",
};

const DRIVE_API_KEY = (import.meta.env.VITE_GOOGLE_API_KEY || "").trim();

const COMPRESSED_EXTENSIONS = new Set([
  "rar",
  "zip",
  "7z",
  "tar",
  "gz",
  "exe",
  "cbp",
]);

const EXTENSION_PATTERN = /\.([a-z0-9]{2,5})(?:$|[?#])/i;

const metaCache = new Map<string, DriveMeta | null>();

export function parseDriveUrl(url?: string | null): ParsedDriveUrl | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();

  if (host === "docs.google.com") {
    const match = parsed.pathname.match(
      /^\/(document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]+)/,
    );
    if (!match) return null;
    return { id: match[2], kind: DOC_KINDS[match[1]] };
  }

  if (host !== "drive.google.com") return null;

  const folder = parsed.pathname.match(
    /\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]+)/,
  );
  if (folder) return { id: folder[1], kind: "folder" };

  const file = parsed.pathname.match(/\/file\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)/);
  if (file) return { id: file[1], kind: "file" };

  const idParam = parsed.searchParams.get("id");
  if (idParam && /^[A-Za-z0-9_-]{10,}$/.test(idParam)) {
    return { id: idParam, kind: "file" };
  }

  return null;
}

export function getDriveId(url?: string | null): string | null {
  return parseDriveUrl(url)?.id ?? null;
}

export function toEmbedUrl(url?: string | null): string | null {
  const parsed = parseDriveUrl(url);
  if (!parsed) return null;

  const { id, kind } = parsed;
  const safeId = encodeURIComponent(id);

  switch (kind) {
    case "folder":
      return `https://drive.google.com/embeddedfolderview?id=${safeId}#list`;
    case "doc":
      return `https://docs.google.com/document/d/${safeId}/preview`;
    case "sheet":
      return `https://docs.google.com/spreadsheets/d/${safeId}/preview`;
    case "slides":
      return `https://docs.google.com/presentation/d/${safeId}/embed`;
    default:
      return `https://drive.google.com/file/d/${safeId}/preview`;
  }
}

export function hasDriveApiKey(): boolean {
  return Boolean(DRIVE_API_KEY);
}

export async function fetchDriveMeta(url?: string | null): Promise<DriveMeta | null> {
  const id = getDriveId(url);
  if (!id || !DRIVE_API_KEY) return null;
  if (metaCache.has(id)) return metaCache.get(id) ?? null;

  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}` +
        `?fields=name,mimeType&key=${encodeURIComponent(DRIVE_API_KEY)}&supportsAllDrives=true`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      metaCache.set(id, null);
      return null;
    }
    const data = (await response.json()) as DriveMeta;
    if (!data?.name || !data?.mimeType) {
      metaCache.set(id, null);
      return null;
    }
    const meta = { name: data.name, mimeType: data.mimeType };
    metaCache.set(id, meta);
    return meta;
  } catch {
    metaCache.set(id, null);
    return null;
  }
}

export async function isDriveAccessible(
  url?: string | null,
): Promise<boolean | null> {
  const id = getDriveId(url);
  if (!id || !DRIVE_API_KEY) return null;

  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}` +
        `?fields=id&key=${encodeURIComponent(DRIVE_API_KEY)}&supportsAllDrives=true`,
      { cache: "no-store" },
    );
    if (response.ok) return true;
    if (response.status === 403 || response.status === 404) return false;
    return null;
  } catch {
    return null;
  }
}

function extensionFrom(value?: string | null): string | null {
  if (!value) return null;
  const clean = String(value).trim().toLowerCase();
  if (!clean.includes(".")) return null;
  const namePart = clean.split("/").pop() || clean;
  const match = namePart.match(EXTENSION_PATTERN);
  return match ? match[1].toLowerCase() : null;
}

export function getCompressedReason(
  name?: string | null,
  mimeType?: string | null,
): string | null {
  const mime = String(mimeType || "").toLowerCase();
  if (mime) {
    if (
      mime.startsWith("application/x-") ||
      mime === "application/zip" ||
      mime === "application/vnd.rar"
    ) {
      return mime;
    }
  }

  const extension = extensionFrom(name);
  if (extension && COMPRESSED_EXTENSIONS.has(extension)) return extension;

  return null;
}
