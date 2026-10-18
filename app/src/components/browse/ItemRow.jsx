import {
  Download,
  ExternalLink,
  File,
  FileText,
  Image,
  LayoutTemplate,
  Music,
  Play,
  Presentation,
} from "lucide-react";

export function isHtmlItem(item) {
  if (item.file_type === "html" || item.file_type === "htm") return true;
  return /\.html?($|\?)/i.test(item.url || "");
}

export function isVideoItem(item) {
  if (item.type === "video") return true;
  return /youtu\.?be|vimeo\.com/i.test(item.url || "");
}

const HF_FILE_PATTERN = /huggingface\.co\/.+\/resolve\//i;

export function isStorageFile(item) {
  const url = item.url || "";
  return (
    url.includes("/storage/v1/object/public/media/") ||
    HF_FILE_PATTERN.test(url)
  );
}

export function downloadHref(item) {
  const url = item.url || "";
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

const isExternalPlatformUrl = (url) =>
  /youtu\.?be|vimeo\.com|drive\.google|docs\.google|dropbox\.com/i.test(url);

export function mediaKind(item) {
  const url = item.url || "";
  if (!url || isHtmlItem(item) || isExternalPlatformUrl(url)) return null;
  const fileType = (item.file_type || "").toLowerCase().replace(/^\./, "");
  const extension = (
    url.split("?")[0].match(/\.([a-z0-9]+)$/i)?.[1] || ""
  ).toLowerCase();
  if (
    VIDEO_EXTENSIONS.includes(fileType) ||
    VIDEO_EXTENSIONS.includes(extension)
  )
    return "video";
  if (
    AUDIO_EXTENSIONS.includes(fileType) ||
    AUDIO_EXTENSIONS.includes(extension)
  )
    return "audio";
  return null;
}

export function isPlayableMedia(item) {
  return mediaKind(item) !== null;
}

function ItemIcon({ item }) {
  const className = "flex-shrink-0";
  const kind = mediaKind(item);
  if (kind === "video" || isVideoItem(item))
    return <Play size={12} className={className} />;
  if (kind === "audio") return <Music size={12} className={className} />;
  const type = (item.file_type || "").toLowerCase();
  if (type === "pdf") return <FileText size={12} className={className} />;
  if (type === "html" || type === "htm")
    return <LayoutTemplate size={12} className={className} />;
  if (["image", "png", "jpg", "jpeg", "webp", "gif"].includes(type))
    return <Image size={12} className={className} />;
  if (type === "pptx" || type === "ppt")
    return <Presentation size={12} className={className} />;
  if (type === "docx" || type === "doc")
    return <FileText size={12} className={className} />;
  return <File size={12} className={className} />;
}

export default function ItemRow({ item, color, onOpenHtml, onOpenMedia }) {
  const itemClass =
    "flex items-center gap-2 text-xs p-2 rounded-lg hover:bg-white/5 transition-colors group flex-1 min-w-0 text-left";
  const icon = <ItemIcon item={item} />;
  const label = <span className="flex-1 truncate">{item.title}</span>;
  const trailing = (
    <ExternalLink
      size={10}
      className="opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0"
    />
  );

  return (
    <div className="flex items-center gap-0.5">
      {isHtmlItem(item) ? (
        <button
          type="button"
          onClick={() => onOpenHtml(item)}
          className={itemClass}
          style={{ color }}
        >
          {icon}
          {label}
          {trailing}
        </button>
      ) : isPlayableMedia(item) ? (
        <button
          type="button"
          onClick={() => onOpenMedia?.(item)}
          className={itemClass}
          style={{ color }}
        >
          {icon}
          {label}
          {trailing}
        </button>
      ) : (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className={itemClass}
          style={{ color }}
        >
          {icon}
          {label}
          {trailing}
        </a>
      )}
      {!isVideoItem(item) && isStorageFile(item) && (
        <a
          href={downloadHref(item)}
          download
          title="تحميل الملف"
          aria-label={`تحميل ${item.title}`}
          className="p-2 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-white/5 transition-colors flex-shrink-0"
        >
          <Download size={12} />
        </a>
      )}
    </div>
  );
}
