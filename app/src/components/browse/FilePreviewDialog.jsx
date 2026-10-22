import { useEffect, useState } from "react";
import {
  Download,
  ExternalLink,
  File,
  FileQuestion,
  LoaderCircle,
  X,
} from "lucide-react";
import { safeHttpUrl } from "@/lib/materialPreview";

const OFFICE_VIEWER_URL =
  "https://view.officeapps.live.com/op/embed.aspx?src=";

function officeEmbedUrl(url) {
  return `${OFFICE_VIEWER_URL}${encodeURIComponent(url || "")}`;
}

export default function FilePreviewDialog({
  open,
  item,
  kind,
  downloadUrl,
  youtubeId,
  youtubePlaylistId,
  onClose,
}) {
  const textUrl = open && item && kind === "text" ? safeHttpUrl(item.url) : "";
  const [textContent, setTextContent] = useState(null);
  const [textError, setTextError] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!textUrl) {
      setTextContent(null);
      setTextError(false);
      return;
    }
    let cancelled = false;
    setTextContent(null);
    setTextError(false);
    fetch(textUrl)
      .then((response) => {
        if (!response.ok) throw new Error("fetch failed");
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setTextContent(text);
      })
      .catch(() => {
        if (!cancelled) setTextError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [textUrl]);

  if (!open || !item) return null;

  const title = item.title || "معاينة الملف";
  const fileUrl = safeHttpUrl(item.url);
  const effectiveDownloadUrl = safeHttpUrl(downloadUrl) || fileUrl;
  const youtubeEmbedSrc = youtubeId
    ? `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`
    : youtubePlaylistId
      ? `https://www.youtube-nocookie.com/embed/videoseries?list=${youtubePlaylistId}&rel=0`
      : null;
  const youtubeWatchUrl = youtubeId
    ? `https://www.youtube.com/watch?v=${youtubeId}`
    : youtubePlaylistId
      ? `https://www.youtube.com/playlist?list=${youtubePlaylistId}`
      : fileUrl;

  const toolbarLinkClass =
    "inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary px-2 py-1.5 rounded border border-border/50 hover:border-primary/30 transition-colors flex-shrink-0";
  const primaryButtonClass =
    "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:brightness-110 transition-all";

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-stretch sm:items-center justify-center sm:p-6"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        dir="rtl"
        className="w-full h-full sm:h-auto sm:max-w-5xl sm:rounded-xl border-0 sm:border border-border overflow-hidden shadow-2xl flex flex-col"
        style={{ background: "hsl(240,30%,7%)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-border flex-shrink-0">
          <p className="flex-1 min-w-0 text-sm text-foreground truncate">
            {title}
          </p>
          {(kind === "pdf" ||
            kind === "office" ||
            kind === "image" ||
            kind === "text") && (
            <>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="فتح في تاب جديد"
                aria-label="فتح في تاب جديد"
                className={toolbarLinkClass}
              >
                <ExternalLink size={12} />
                <span className="hidden sm:inline">فتح في تاب جديد</span>
              </a>
              <a
                href={effectiveDownloadUrl}
                download
                title="تحميل الملف"
                aria-label={`تحميل ${title}`}
                className={toolbarLinkClass}
              >
                <Download size={12} />
                <span className="hidden sm:inline">تحميل</span>
              </a>
            </>
          )}
          {kind === "youtube" && (
            <a
              href={youtubeWatchUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="فتح على YouTube"
              aria-label="فتح على YouTube"
              className={toolbarLinkClass}
            >
              <ExternalLink size={12} />
              <span className="hidden sm:inline">فتح على YouTube</span>
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="text-muted-foreground hover:text-foreground p-1 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {kind === "pdf" ? (
            <div className="flex-1 min-h-0 sm:flex-none sm:h-[80vh] bg-white">
            <iframe
              src={fileUrl}
              title={title}
              className="w-full h-full border-0"
              style={{ background: "#fff", colorScheme: "light" }}
            />
          </div>
        ) : kind === "office" ? (
          <>
          <div className="flex-1 min-h-0 sm:flex-none sm:h-[80vh] bg-white">
              <iframe
                src={officeEmbedUrl(fileUrl)}
                title={title}
                className="w-full h-full border-0"
                style={{ background: "#fff", colorScheme: "light" }}
                allowFullScreen
              />
            </div>
            <p className="px-4 py-2 text-[11px] text-muted-foreground/80 border-t border-border/40 flex-shrink-0">
              لو المعاينة مش ظاهرة، جرّب تفتح الملف في تاب جديد أو تحمّله.
            </p>
          </>
        ) : kind === "youtube" && youtubeEmbedSrc ? (
          <div className="flex-1 min-h-0 flex items-center justify-center bg-black p-3 sm:p-6">
            <div className="relative w-full max-w-4xl max-h-full aspect-video">
              <iframe
                src={youtubeEmbedSrc}
                title={title}
                className="absolute inset-0 h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        ) : kind === "image" ? (
          <div className="flex-1 min-h-0 flex items-center justify-center bg-black/50 p-3 sm:p-6 overflow-auto">
            <img
              src={fileUrl}
              alt={title}
              className="max-h-full max-w-full object-contain rounded-md"
            />
          </div>
        ) : kind === "text" ? (
          <div className="flex-1 min-h-0 overflow-auto bg-[#0b1220]">
            {textError ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
                <FileQuestion size={36} className="text-primary" />
                <p className="text-sm text-muted-foreground">
                  مش قادرين نحمّل محتوى الملف ده للمعاينة.
                </p>
                <a
                  href={effectiveDownloadUrl}
                  download
                  className={primaryButtonClass}
                >
                  <Download size={16} /> تحميل الملف
                </a>
              </div>
            ) : textContent === null ? (
              <div className="h-full flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle size={16} className="animate-spin" />
                جاري تحميل الملف...
              </div>
            ) : (
              <pre
                dir="ltr"
                className="p-4 text-xs leading-relaxed text-slate-200 font-mono whitespace-pre-wrap break-words"
              >
                {textContent}
              </pre>
            )}
          </div>
        ) : kind === "onedrive" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="p-4 rounded-full bg-primary/10">
              <File size={40} className="text-primary" />
            </div>
            <div className="max-w-md">
              <p className="text-foreground font-semibold break-all">{title}</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                الملف ده موجود على OneDrive ومش بيتعرض داخل المنصة. افتحه على
                OneDrive في تاب جديد.
              </p>
            </div>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={primaryButtonClass}
            >
              <ExternalLink size={16} /> فتح على OneDrive
            </a>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="p-4 rounded-full bg-primary/10">
              <FileQuestion size={40} className="text-primary" />
            </div>
            <div className="max-w-md">
              <p className="text-foreground font-semibold break-all">{title}</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                الملف ده مش بيتعرض داخل المنصة، تقدر تحمله وتفتحه على جهازك.
              </p>
            </div>
            {downloadUrl ? (
              <a href={downloadUrl} download className={primaryButtonClass}>
                <Download size={16} /> تحميل الملف
              </a>
            ) : (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={primaryButtonClass}
              >
                <ExternalLink size={16} /> فتح الملف
              </a>
            )}
            {downloadUrl && fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                أو افتحه في تاب جديد
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
