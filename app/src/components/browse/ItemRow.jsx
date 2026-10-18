import {
  Download,
  ExternalLink,
  File,
  FileText,
  Image,
  LayoutTemplate,
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

export function isStorageFile(item) {
  return (item.url || "").includes("/storage/v1/object/public/media/");
}

export function downloadHref(item) {
  const stored = decodeURIComponent(
    (item.url || "").split("?")[0].split("/").pop() || "file",
  );
  const cleanName = stored.replace(/^[0-9a-f]{9,12}_/i, "") || "file";
  const separator = item.url.includes("?") ? "&" : "?";
  return `${item.url}${separator}download=${encodeURIComponent(cleanName)}`;
}

function ItemIcon({ item }) {
  const className = "flex-shrink-0";
  if (isVideoItem(item)) return <Play size={12} className={className} />;
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

export default function ItemRow({ item, color, onOpenHtml }) {
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
