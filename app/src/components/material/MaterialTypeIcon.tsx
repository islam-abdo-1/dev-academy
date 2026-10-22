import {
  File,
  FileArchive,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Globe,
  Image as ImageIcon,
  Link2,
  Music,
  Presentation,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getFileExtension, mediaKind } from "@/lib/materialPreview";

interface MaterialTypeIconProps {
  fileType?: string | null;
  mimeType?: string | null;
  url?: string | null;
  type?: string | null;
  className?: string;
  size?: number;
}

export function MaterialTypeIcon({
  fileType,
  mimeType,
  url,
  type,
  className,
  size = 20,
}: MaterialTypeIconProps) {
  const normalized = (fileType || "").toLowerCase().replace(/^\./, "");
  const extension = getFileExtension({ file_type: normalized, url });
  const kind = mediaKind({ file_type: normalized, mime_type: mimeType, url, type });

  if (normalized === "link" || normalized === "url") {
    return <Link2 size={size} className={cn("text-sky-400", className)} />;
  }
  if (kind === "audio" || normalized === "audio") {
    return <Music size={size} className={cn("text-violet-400", className)} />;
  }
  if (kind === "video" || normalized === "video" || type === "video") {
    return <Video size={size} className={cn("text-blue-400", className)} />;
  }
  if (normalized === "archive" || ["zip", "rar", "7z", "tar", "gz"].includes(extension)) {
    return <FileArchive size={size} className={cn("text-amber-400", className)} />;
  }
  if (
    ["doc", "docx", "rtf"].includes(normalized) ||
    ["doc", "docx", "rtf"].includes(extension)
  ) {
    return <FileText size={size} className={cn("text-sky-400", className)} />;
  }
  if (
    ["ppt", "pptx"].includes(normalized) ||
    ["ppt", "pptx"].includes(extension)
  ) {
    return <Presentation size={size} className={cn("text-orange-400", className)} />;
  }
  if (
    ["xls", "xlsx", "csv"].includes(normalized) ||
    ["xls", "xlsx", "csv"].includes(extension)
  ) {
    return <FileSpreadsheet size={size} className={cn("text-emerald-400", className)} />;
  }
  if (normalized === "pdf" || extension === "pdf") {
    return <FileText size={size} className={cn("text-red-400", className)} />;
  }
  if (normalized === "image" || ["png", "jpg", "jpeg", "webp", "gif", "svg", "avif"].includes(extension)) {
    return <ImageIcon size={size} className={cn("text-green-400", className)} />;
  }
  if (
    ["py", "txt", "md", "json", "js", "jsx", "ts", "tsx", "css", "c", "cpp", "h", "java", "sql", "xml", "yml", "yaml"].includes(extension) ||
    normalized === "code"
  ) {
    return <FileCode2 size={size} className={cn("text-cyan-400", className)} />;
  }
  if (normalized === "html" || normalized === "htm" || ["html", "htm"].includes(extension)) {
    return <Globe size={size} className={cn("text-orange-400", className)} />;
  }
  return <File size={size} className={cn("text-muted-foreground", className)} />;
}
