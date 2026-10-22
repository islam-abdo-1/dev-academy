export type FileCategory =
  | "pdf"
  | "html"
  | "docx"
  | "pptx"
  | "xlsx"
  | "doc"
  | "ppt"
  | "xls"
  | "zip"
  | "rar"
  | "7z"
  | "mp4"
  | "webm"
  | "mp3"
  | "wav"
  | "m4a"
  | "py"
  | "txt"
  | "md"
  | "csv"
  | "json"
  | "image"
  | "code"
  | "archive"
  | "video"
  | "audio"
  | "other";

export interface FileClassification {
  category: FileCategory;
  mimeType: string;
  extension: string;
  icon: string;
}

export function classifyFile(fileName: string): FileClassification {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    html: "text/html",
    htm: "text/html",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ppt: "application/vnd.ms-powerpoint",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    zip: "application/zip",
    rar: "application/x-rar-compressed",
    "7z": "application/x-7z-compressed",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    py: "text/x-python",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
  };

  const categories: Record<string, FileCategory> = {
    pdf: "pdf",
    html: "html",
    htm: "html",
    docx: "docx",
    doc: "doc",
    pptx: "pptx",
    ppt: "ppt",
    xlsx: "xlsx",
    xls: "xls",
    zip: "archive",
    rar: "archive",
    "7z": "archive",
    mp4: "video",
    webm: "video",
    mp3: "audio",
    wav: "audio",
    m4a: "audio",
    py: "code",
    txt: "code",
    md: "code",
    csv: "code",
    json: "code",
    png: "image",
    jpg: "image",
    jpeg: "image",
    webp: "image",
    gif: "image",
  };

  const category = categories[ext] || "other";
  const mimeType = mimeTypes[ext] || "application/octet-stream";

  const icons: Record<string, string> = {
    pdf: "📄",
    html: "🌐",
    docx: "📝",
    doc: "📝",
    pptx: "📊",
    ppt: "📊",
    xlsx: "📈",
    xls: "📈",
    zip: "📦",
    rar: "📦",
    "7z": "📦",
    mp4: "🎬",
    webm: "🎬",
    mp3: "🎵",
    wav: "🎵",
    m4a: "🎵",
    py: "🐍",
    txt: "📝",
    md: "📝",
    csv: "📊",
    json: "📋",
    png: "🖼️",
    jpg: "🖼️",
    jpeg: "🖼️",
    webp: "🖼️",
    gif: "🖼️",
    archive: "📦",
    video: "🎬",
    audio: "🎵",
    code: "💻",
    image: "🖼️",
    other: "📄",
  };

  return {
    category,
    mimeType,
    extension: ext,
    icon: icons[category] || icons.other,
  };
}

export function generateStoragePath(file: File, prefix = "uploads"): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 100);
  const datePath = new Date().toISOString().slice(0, 10).replace(/-/g, "/");
  return `${prefix}/${datePath}/${hash}_${sanitizedName}.${ext}`;
}
