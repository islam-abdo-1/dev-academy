export type PreviewKind =
  | "pdf"
  | "office"
  | "image"
  | "text"
  | "video"
  | "audio"
  | "html"
  | "archive"
  | "youtube"
  | "drive"
  | "onedrive"
  | "link"
  | "unsupported";

export function safeHttpUrl(value?: string | null): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
  } catch {
    return "";
  }
}

export function isSafeMediaUrl(value?: string | null): boolean {
  const raw = (value || "").trim();
  if (raw.startsWith("blob:")) return true;
  return Boolean(safeHttpUrl(raw));
}

export interface PreviewItem {
  url?: string | null;
  title?: string | null;
  type?: string | null;
  file_type?: string | null;
  mime_type?: string | null;
  fileType?: string | null;
  mimeType?: string | null;
}

export function previewFileType(item: PreviewItem): string {
  return (item.file_type || item.fileType || "").toLowerCase().replace(/^\./, "");
}

export function previewMimeType(item: PreviewItem): string {
  return item.mime_type || item.mimeType || "";
}

const HF_FILE_PATTERN = /huggingface\.co\/.+\/resolve\//i;

export const OFFICE_EXTENSIONS = [
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
];

export const IMAGE_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "svg",
  "bmp",
  "avif",
];

export const TEXT_EXTENSIONS = [
  "py",
  "txt",
  "md",
  "json",
  "csv",
  "js",
  "jsx",
  "ts",
  "tsx",
  "css",
  "c",
  "cpp",
  "h",
  "java",
  "sql",
  "xml",
  "yml",
  "yaml",
  "html",
  "htm",
];

const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "mkv", "ogv"];

const AUDIO_EXTENSIONS = [
  "mp3",
  "m4a",
  "aac",
  "wav",
  "ogg",
  "oga",
  "opus",
  "flac",
];

const ARCHIVE_EXTENSIONS = ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2"];

export function getFileExtension(item: PreviewItem): string {
  const path = (item.url || "").split(/[?#]/)[0];
  const fromUrl = path.match(/\.([a-z0-9]{1,8})$/i)?.[1] || "";
  const fileType = previewFileType(item);
  return (fromUrl || fileType).toLowerCase();
}

export function isHtmlItem(item: PreviewItem): boolean {
  const fileType = previewFileType(item);
  if (fileType === "html" || fileType === "htm") return true;
  return /\.html?($|\?)/i.test(item.url || "");
}

export function isVideoItem(item: PreviewItem): boolean {
  if (item.type === "video") return true;
  return /youtu\.?be|vimeo\.com/i.test(item.url || "");
}

export function isStorageFile(item: PreviewItem): boolean {
  const url = item.url || "";
  return (
    url.includes("/storage/v1/object/public/media/") ||
    HF_FILE_PATTERN.test(url)
  );
}

export function downloadHref(item: PreviewItem): string {
  const url = safeHttpUrl(item.url);
  if (!url) return "";
  const separator = url.includes("?") ? "&" : "?";
  if (HF_FILE_PATTERN.test(url)) {
    return `${url}${separator}download=true`;
  }
  const stored = decodeURIComponent(
    url.split("?")[0].split("/").pop() || "file",
  );
  const cleanName = stored.replace(/^[0-9a-f]{9,12}_/i, "") || "file";
  return `${url}${separator}download=${encodeURIComponent(cleanName)}`;
}

export function getYouTubeId(url?: string | null): string | null {
  const raw = (url || "").trim();
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  let candidate: string | null = null;
  if (host === "youtu.be" || host === "www.youtu.be") {
    candidate = parsed.pathname.split("/").filter(Boolean)[0] || null;
  } else if (
    /^(?:www\.|m\.|music\.)?(?:youtube\.com|youtube-nocookie\.com)$/i.test(
      host,
    )
  ) {
    if (parsed.pathname === "/watch" || parsed.pathname === "/watch/") {
      candidate = parsed.searchParams.get("v");
    } else {
      candidate =
        parsed.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/)?.[1] ||
        null;
    }
  }
  if (candidate?.includes("si=")) {
    candidate = candidate.split("si=")[0];
  }
  return candidate && /^[A-Za-z0-9_-]{6,}$/.test(candidate) ? candidate : null;
}

export function getYouTubePlaylistId(url?: string | null): string | null {
  const raw = (url || "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (
      !/^(?:www\.|m\.|music\.)?(?:youtube\.com|youtube-nocookie\.com)$/i.test(
        host,
      )
    ) {
      return null;
    }
    const candidate = parsed.searchParams.get("list");
    return candidate && /^[A-Za-z0-9_-]{6,}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function isYouTubeItem(item: PreviewItem): boolean {
  return Boolean(getYouTubeId(item.url) || getYouTubePlaylistId(item.url));
}

export function isOneDriveItem(item: PreviewItem): boolean {
  const raw = (item.url || "").trim();
  if (!raw) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return (
      host === "1drv.ms" ||
      host === "www.1drv.ms" ||
      host === "onedrive.live.com" ||
      host === "www.onedrive.live.com"
    );
  } catch {
    return false;
  }
}

export function isDriveItem(item: PreviewItem): boolean {
  const raw = (item.url || "").trim();
  if (!raw) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host === "drive.google.com" || host === "docs.google.com";
  } catch {
    return false;
  }
}

export function isPdfPreviewItem(item: PreviewItem): boolean {
  const fileType = previewFileType(item);
  const mimeType = previewMimeType(item);
  return (
    fileType === "pdf" ||
    mimeType === "application/pdf" ||
    getFileExtension(item) === "pdf"
  );
}

export function isOfficePreviewItem(item: PreviewItem): boolean {
  const fileType = previewFileType(item);
  const mimeType = previewMimeType(item);
  return (
    OFFICE_EXTENSIONS.includes(getFileExtension(item)) ||
    OFFICE_EXTENSIONS.includes(fileType) ||
    Boolean(
      mimeType &&
        /(msword|officedocument|ms-powerpoint|ms-excel)/i.test(mimeType),
    )
  );
}

export function isImagePreviewItem(item: PreviewItem): boolean {
  const fileType = previewFileType(item);
  const mimeType = previewMimeType(item);
  return (
    IMAGE_EXTENSIONS.includes(getFileExtension(item)) ||
    IMAGE_EXTENSIONS.includes(fileType) ||
    mimeType.startsWith("image/")
  );
}

export function isTextPreviewItem(item: PreviewItem): boolean {
  const fileType = previewFileType(item);
  const mimeType = previewMimeType(item);
  return (
    TEXT_EXTENSIONS.includes(getFileExtension(item)) ||
    TEXT_EXTENSIONS.includes(fileType) ||
    Boolean(
      mimeType && /(text\/|json|javascript|xml|yaml|x-sh)/i.test(mimeType),
    )
  );
}

export function isArchiveItem(item: PreviewItem): boolean {
  const fileType = previewFileType(item);
  const extension = getFileExtension(item);
  return (
    fileType === "archive" ||
    ARCHIVE_EXTENSIONS.includes(fileType) ||
    ARCHIVE_EXTENSIONS.includes(extension)
  );
}

export function isDocumentPreviewItem(item: PreviewItem): boolean {
  return isPdfPreviewItem(item) || isOfficePreviewItem(item);
}

function isExternalPlatformUrl(url: string): boolean {
  return /youtu\.?be|vimeo\.com|drive\.google|docs\.google|dropbox\.com|1drv\.ms|onedrive\.live\.com/i.test(
    url,
  );
}

export function mediaKind(item: PreviewItem): "video" | "audio" | null {
  const url = item.url || "";
  if (!url || isHtmlItem(item) || isExternalPlatformUrl(url)) return null;
  const fileType = previewFileType(item);
  const extension = getFileExtension(item);
  if (
    VIDEO_EXTENSIONS.includes(fileType) ||
    VIDEO_EXTENSIONS.includes(extension) ||
    item.type === "video"
  ) {
    return "video";
  }
  if (
    AUDIO_EXTENSIONS.includes(fileType) ||
    AUDIO_EXTENSIONS.includes(extension) ||
    item.type === "audio"
  ) {
    return "audio";
  }
  return null;
}

export function isPlayableMedia(item: PreviewItem): boolean {
  return mediaKind(item) !== null;
}

export function getPreviewKind(item?: PreviewItem | null): PreviewKind | null {
  if (!item) return null;
  if (isYouTubeItem(item)) return "youtube";
  if (isDriveItem(item)) return "drive";
  if (isOneDriveItem(item)) return "onedrive";
  if (isArchiveItem(item)) return "archive";
  if (isHtmlItem(item)) return "html";
  if (isPdfPreviewItem(item)) return "pdf";
  if (isOfficePreviewItem(item)) return "office";
  if (isImagePreviewItem(item)) return "image";
  const media = mediaKind(item);
  if (media) return media;
  if (isTextPreviewItem(item)) return "text";
  return "link";
}
