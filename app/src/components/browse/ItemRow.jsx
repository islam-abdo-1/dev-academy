import {
  BookmarkPlus,
  Download,
  ExternalLink,
  File,
  FileText,
  Image,
  LayoutTemplate,
  Music,
  Play,
  Presentation,
  Share2,
} from "lucide-react";
import {
  downloadHref,
  getPreviewKind,
  isHtmlItem,
  isPlayableMedia,
  isStorageFile,
  isVideoItem,
  mediaKind,
} from "@/lib/materialPreview";
import { useMaterialViewer } from "@/components/material/MaterialViewerProvider";
import { RatingButtons } from "@/components/material/RatingButtons";
import { materialFromOfficial } from "@/components/material/types";

export {
  downloadHref,
  getPreviewKind,
  isDocumentPreviewItem,
  isHtmlItem,
  isImagePreviewItem,
  isOfficePreviewItem,
  isOneDriveItem,
  isPdfPreviewItem,
  isPlayableMedia,
  isStorageFile,
  isTextPreviewItem,
  isVideoItem,
  isYouTubeItem,
  getYouTubeId,
  getYouTubePlaylistId,
  mediaKind,
} from "@/lib/materialPreview";

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

export default function ItemRow({ item, color, kind = "lecture" }) {
  const { openMaterial, openQuickSave, openShare } = useMaterialViewer();
  const material = materialFromOfficial(item, kind);
  const ratingType = kind === "section" ? "section_item" : "lecture_item";
  const previewKind = getPreviewKind(item);
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

  const content = (
    <>
      {icon}
      {label}
      {trailing}
    </>
  );

  return (
    <div className="flex items-center gap-0.5">
      {item.url ? (
        <button
          type="button"
          onClick={() => openMaterial(material)}
          className={itemClass}
          style={{ color }}
        >
          {content}
        </button>
      ) : (
        <span className={itemClass} style={{ color }}>
          {content}
        </span>
      )}

      <RatingButtons
        materialType={ratingType}
        materialId={String(item.id)}
        compact
      />

      <button
        type="button"
        onClick={() => openQuickSave(material)}
        title="حفظ في الخزنة"
        aria-label={`حفظ ${item.title} في الخزنة`}
        className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-primary hover:bg-white/5 transition-colors flex-shrink-0"
      >
        <BookmarkPlus size={12} />
      </button>
      <button
        type="button"
        onClick={() => openShare(material)}
        title="مشاركة"
        aria-label={`مشاركة ${item.title}`}
        className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-primary hover:bg-white/5 transition-colors flex-shrink-0"
      >
        <Share2 size={12} />
      </button>

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
