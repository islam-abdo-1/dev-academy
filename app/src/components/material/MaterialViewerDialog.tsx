import { useEffect, useState } from "react";
import {
  BookmarkPlus,
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
  Share2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MaterialPreview } from "@/components/material/MaterialPreview";
import { MaterialTypeIcon } from "@/components/material/MaterialTypeIcon";
import { downloadHref, isStorageFile, safeHttpUrl } from "@/lib/materialPreview";
import type { Material } from "@/components/material/types";

interface MaterialViewerDialogProps {
  material: Material | null;
  onClose: () => void;
  onShare: (material: Material) => void;
  onSave: (material: Material) => void;
  inactive?: boolean;
}

export function MaterialViewerDialog({
  material,
  onClose,
  onShare,
  onSave,
  inactive = false,
}: MaterialViewerDialogProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [material?.id]);

  useEffect(() => {
    if (!material) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (inactive) return;
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [material, inactive, onClose]);

  if (!material) return null;

  const safeUrl = safeHttpUrl(material.url);
  const downloadUrl = isStorageFile(material) ? downloadHref(material) : safeUrl;
  const showDownload = material.canDownload !== false && Boolean(downloadUrl);
  const sourceLabel =
    material.source === "shared"
      ? "مشاركة عامة"
      : material.source === "personal"
        ? "ملف شخصي"
        : material.source === "external"
          ? "رابط خارجي"
          : material.source === "resource"
            ? "مورد"
            : "مادة رسمية";

  return (
    <div
      className={`fixed inset-0 z-[10010] flex items-center justify-center bg-black/85 p-0 backdrop-blur-sm ${expanded ? "sm:p-0" : "sm:p-5"}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={material.title}
        dir="rtl"
        className={`flex h-full w-full flex-col overflow-hidden border border-border bg-[hsl(240,30%,7%)] shadow-2xl sm:rounded-2xl ${
          expanded
            ? "sm:h-screen sm:max-w-none sm:rounded-none"
            : "sm:h-[92vh] sm:max-w-6xl"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="hidden rounded-lg bg-primary/10 p-2 sm:block">
              <MaterialTypeIcon
                fileType={material.fileType}
                mimeType={material.mimeType}
                url={material.url}
                type={material.itemType}
                size={18}
              />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground sm:text-base">
                {material.title}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {sourceLabel}
                {material.permission === "view" ? " - عرض فقط" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {material.canSave && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSave(material)}
                title="حفظ في الخزنة"
                aria-label="حفظ في الخزنة"
                className="h-8 gap-1.5 px-2 text-xs"
              >
                <BookmarkPlus className="h-4 w-4" />
                <span className="hidden sm:inline">حفظ</span>
              </Button>
            )}
            {material.canShare && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onShare(material)}
                title="مشاركة"
                aria-label="مشاركة"
                className="h-8 gap-1.5 px-2 text-xs"
              >
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">مشاركة</span>
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((value) => !value)}
              title={expanded ? "تصغير" : "تكبير"}
              aria-label={expanded ? "تصغير" : "تكبير"}
              className="h-8 w-8 px-0"
            >
              {expanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            {showDownload && (
              <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
                <a
                  href={downloadUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  title="تحميل"
                  aria-label="تحميل"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">تحميل</span>
                </a>
              </Button>
            )}
            {safeUrl && (
              <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs">
                <a
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="فتح في نافذة جديدة"
                  aria-label="فتح في نافذة جديدة"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="mr-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <MaterialPreview material={material} />
        </div>
      </div>
    </div>
  );
}
