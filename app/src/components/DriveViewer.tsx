import { useEffect, useState } from "react";
import {
  Download,
  ExternalLink,
  FileArchive,
  FileQuestion,
  Loader2,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  fetchDriveMeta,
  getCompressedReason,
  hasDriveApiKey,
  isDriveAccessible,
  parseDriveUrl,
  toEmbedUrl,
} from "@/utils/drive";
import { useAuth } from "@/lib/AuthContext";
import { safeHttpUrl } from "@/lib/materialPreview";

interface DriveViewerProps {
  open: boolean;
  url?: string | null;
  title?: string | null;
  fileType?: string | null;
  driveFileName?: string | null;
  driveMimeType?: string | null;
  onClose: () => void;
}

type FolderState = "checking" | "ok" | "denied";

export default function DriveViewer({
  open,
  url,
  title,
  fileType,
  driveFileName,
  driveMimeType,
  onClose,
}: DriveViewerProps) {
  const { isStaff } = useAuth();
  const [loaded, setLoaded] = useState(false);
  const [resolvedName, setResolvedName] = useState<string | null>(
    driveFileName || null,
  );
  const [resolvedMime, setResolvedMime] = useState<string | null>(
    driveMimeType || null,
  );
  const [folderState, setFolderState] = useState<FolderState>("ok");

  const parsed = parseDriveUrl(url);
  const isFolder = parsed?.kind === "folder";
  const embedUrl = toEmbedUrl(url);
  const safeUrl = safeHttpUrl(url);

  useEffect(() => {
    if (!open) {
      setLoaded(false);
      return;
    }

    setLoaded(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, url, onClose]);

  useEffect(() => {
    setResolvedName(driveFileName || null);
    setResolvedMime(driveMimeType || null);
  }, [driveFileName, driveMimeType, url]);

  useEffect(() => {
    if (!open || !url) return;
    if (resolvedName && resolvedMime) return;
    if (!hasDriveApiKey()) return;

    let cancelled = false;
    fetchDriveMeta(url).then((meta) => {
      if (cancelled || !meta) return;
      setResolvedName((current) => current || meta.name);
      setResolvedMime((current) => current || meta.mimeType);
    });

    return () => {
      cancelled = true;
    };
  }, [open, url, resolvedName, resolvedMime]);

  useEffect(() => {
    if (!open || !isFolder || !url) return;
    if (!hasDriveApiKey()) {
      setFolderState("ok");
      return;
    }

    let cancelled = false;
    setFolderState("checking");
    isDriveAccessible(url).then((accessible) => {
      if (cancelled) return;
      setFolderState(accessible === false ? "denied" : "ok");
    });

    return () => {
      cancelled = true;
    };
  }, [open, isFolder, url]);

  if (!open) return null;

  const displayFileName = resolvedName || driveFileName || null;
  const displayTitle =
    displayFileName ||
    (title && title !== "drive.google.com" ? title : "معاينة ملف Google Drive");
  const compressed =
    getCompressedReason(displayFileName || title, resolvedMime || driveMimeType) ||
    getCompressedReason(fileType, null);
  const downloadUrl = parsed
    ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(parsed.id)}`
    : null;

  const toolbarLinkClass =
    "inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary px-2 py-1.5 rounded border border-border/50 hover:border-primary/30 transition-colors flex-shrink-0";

  const openInNewTab = url ? (
    <a
      href={safeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/10 transition-colors"
    >
      <ExternalLink size={14} /> فتح في تاب جديد
    </a>
  ) : null;

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
        aria-label={displayTitle}
        dir="rtl"
        className="w-full h-full sm:h-auto sm:max-w-5xl sm:rounded-xl border-0 sm:border border-border overflow-hidden shadow-2xl flex flex-col"
        style={{ background: "hsl(240,30%,7%)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-border flex-shrink-0">
          <p className="flex-1 min-w-0 text-sm text-foreground truncate">
            {displayTitle}
          </p>
          {safeUrl && (
            <a
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="فتح في تاب جديد"
              aria-label="فتح في تاب جديد"
              className={toolbarLinkClass}
            >
              <ExternalLink size={12} />
              <span className="hidden sm:inline">فتح في تاب جديد</span>
            </a>
          )}
          {downloadUrl && !isFolder && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="تحميل الملف"
              aria-label="تحميل الملف"
              className={toolbarLinkClass}
            >
              <Download size={12} />
              <span className="hidden sm:inline">تحميل</span>
            </a>
          )}
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="text-muted-foreground hover:text-foreground p-1 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {!embedUrl ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10 text-center">
            <FileQuestion size={40} className="text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              الرابط ده مش ملف Google Drive قابل للعرض داخل المنصة.
            </p>
            {openInNewTab}
          </div>
        ) : compressed ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="p-4 rounded-full bg-primary/10">
              <FileArchive size={42} className="text-primary" />
            </div>
            <div className="max-w-md">
              <p className="text-foreground font-semibold break-all">
                {displayTitle}
              </p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                الملف ده مضغوط ومينفعش يتعرض هنا، حمّله وافتحه على جهازك.
              </p>
            </div>
            {downloadUrl && (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:brightness-110 transition-all"
              >
                <Download size={16} /> تحميل الملف
              </a>
            )}
            {safeUrl && (
              <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                أو افتحه في Google Drive
              </a>
            )}
          </div>
        ) : isFolder && folderState === "checking" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-xs">جاري التحقق من المشاركة…</span>
          </div>
        ) : isFolder && folderState === "denied" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="p-4 rounded-full bg-destructive/10">
              <ShieldAlert size={38} className="text-destructive" />
            </div>
            <div className="max-w-md">
              <p className="text-foreground font-semibold">
                {isStaff ? "الفولدر مش متشارك" : "الملف مش متاح حالياً"}
              </p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {isStaff
                  ? "غيّر المشاركة لـ أي شخص لديه الرابط ← مشاهد."
                  : "جرّب تفتحه في تاب جديد أو راجع المدرس."}
              </p>
            </div>
            {openInNewTab}
          </div>
        ) : (
          <>
            <div className="relative flex-1 min-h-0 sm:flex-none sm:h-[80vh] bg-background/40">
              {!loaded && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 size={24} className="animate-spin" />
                  <span className="text-xs">جاري تحميل المعاينة…</span>
                </div>
              )}
              <iframe
                key={embedUrl}
                src={embedUrl}
                title={displayTitle}
                className="absolute inset-0 h-full w-full"
                style={{ background: "#fff", colorScheme: "light" }}
                allow="autoplay; fullscreen"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={() => setLoaded(true)}
              />
            </div>
            {isStaff && (
              <p className="px-4 py-2 text-[11px] text-muted-foreground/80 border-t border-border/40 flex items-center gap-1.5 flex-shrink-0">
                <ShieldAlert size={12} className="flex-shrink-0" />
                لو الملف مش بيظهر، تأكد إن مشاركته: أي شخص لديه الرابط ← مشاهد.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
