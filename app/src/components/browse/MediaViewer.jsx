import { useEffect } from "react";
import { Download, ExternalLink, X } from "lucide-react";
import { downloadHref, isStorageFile, mediaKind } from "./ItemRow";
import { safeHttpUrl } from "@/lib/materialPreview";

export default function MediaViewer({ open, item, onClose }) {
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

  if (!open || !item) return null;

  const kind = mediaKind(item) || "video";
  const safeUrl = safeHttpUrl(item.url);

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.title || "مشغل الوسائط"}
        className="w-full max-w-3xl rounded-xl border border-border overflow-hidden shadow-2xl flex flex-col"
        style={{ background: "hsl(240,30%,7%)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-border flex-shrink-0">
          <p className="flex-1 text-sm text-foreground truncate">{item.title}</p>
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="افتح في تاب جديد"
            aria-label="افتح في تاب جديد"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary px-2 py-1 rounded border border-border/50 hover:border-primary/30 transition-colors"
          >
            <ExternalLink size={12} />
            <span className="hidden sm:inline">افتح في تاب جديد</span>
          </a>
          {isStorageFile(item) && (
            <a
              href={downloadHref(item)}
              download
              title="تحميل الملف"
              aria-label={`تحميل ${item.title}`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary px-2 py-1 rounded border border-border/50 hover:border-primary/30 transition-colors"
            >
              <Download size={12} />
              <span className="hidden sm:inline">تحميل</span>
            </a>
          )}
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X size={16} />
          </button>
        </div>
        {kind === "audio" ? (
          <div className="bg-background/60 px-4 py-8 sm:px-8 sm:py-10">
            <audio src={safeUrl} controls className="w-full" />
          </div>
        ) : (
          <video
            src={safeUrl}
            controls
            playsInline
            className="w-full max-h-[75vh] bg-black"
          />
        )}
      </div>
    </div>
  );
}
