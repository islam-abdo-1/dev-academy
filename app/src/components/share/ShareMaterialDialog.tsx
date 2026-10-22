import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, LoaderCircle, QrCode, Share2, Trash2, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useShareList } from "@/hooks/useShareList";
import { materialShareLabel, type Material } from "@/components/material/types";
import { MaterialTypeIcon } from "@/components/material/MaterialTypeIcon";

interface ShareMaterialDialogProps {
  open: boolean;
  material: Material | null;
  onClose: () => void;
}

export function ShareMaterialDialog({ open, material, onClose }: ShareMaterialDialogProps) {
  const { creating, error, created, createShareLink, revokeShareLink, reset } = useShareList();
  const [permission, setPermission] = useState<"view" | "download">("view");
  const [copied, setCopied] = useState(false);

  const target = material?.share || null;
  const label = useMemo(
    () => (target ? materialShareLabel(target.resourceType) : "رابط مباشر"),
    [target],
  );

  useEffect(() => {
    if (!open) return;
    reset();
    setPermission("view");
    setCopied(false);
  }, [open, material?.id, reset]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !material) return null;

  const handleCreate = async () => {
    if (!target) {
      if (!material.url) {
        toast.error("هذا العنصر لا يحتوي على رابط قابل للمشاركة");
        return;
      }
      try {
        await navigator.clipboard.writeText(material.url);
        toast.success("تم نسخ رابط الملف");
        onClose();
      } catch {
        toast.error("تعذر نسخ الرابط");
      }
      return;
    }

    const result = await createShareLink({
      resourceType: target.resourceType,
      resourceId: target.resourceId,
      scope: "all",
      permission,
    });

    if (result) {
      window.dispatchEvent(new Event("dev-academy:shares-changed"));
      toast.success("تم إنشاء رابط المشاركة");
    }
  };

  const handleCopy = async () => {
    if (!created?.url) return;
    await navigator.clipboard.writeText(created.url);
    setCopied(true);
    toast.success("تم نسخ الرابط");
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleRevoke = async () => {
    if (!created) return;
    const ok = await revokeShareLink(created.token);
    if (ok) {
      window.dispatchEvent(new Event("dev-academy:shares-changed"));
      toast.success("تم إلغاء رابط المشاركة");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10020] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`مشاركة ${material.title}`}
        dir="rtl"
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-2xl sm:max-w-lg sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-border p-4">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <MaterialTypeIcon
              fileType={material.fileType}
              mimeType={material.mimeType}
              url={material.url}
              type={material.itemType}
              size={22}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <Share2 className="h-4 w-4 text-primary" />
              مشاركة {label}
            </h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">{material.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!created ? (
            <div className="space-y-4">
              {!target && (
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm leading-relaxed text-muted-foreground">
                  هذا العنصر غير مخزن كملف داخل المنصة، لذلك سيتم نسخ رابط المصدر المباشر.
                </div>
              )}

              {target && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">الصلاحية</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPermission("view")}
                        className={`rounded-lg border p-3 text-right text-sm transition-colors ${
                          permission === "view"
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:bg-accent/50"
                        }`}
                      >
                        عرض فقط
                      </button>
                      <button
                        type="button"
                        onClick={() => setPermission("download")}
                        className={`rounded-lg border p-3 text-right text-sm transition-colors ${
                          permission === "download"
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground hover:bg-accent/50"
                        }`}
                      >
                        عرض وتحميل
                      </button>
                    </div>
                  </div>

                </>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="rounded-xl bg-white p-3">
                  <QRCodeSVG value={created.url} size={184} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <QrCode className="h-4 w-4" />
                  رابط المشاركة
                </label>
                <div className="flex gap-2">
                  <Input value={created.url} readOnly className="flex-1 bg-muted text-xs" dir="ltr" />
                  <Button type="button" variant="outline" onClick={handleCopy} aria-label="نسخ الرابط">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border p-4">
          {created ? (
            <Button type="button" variant="ghost" className="text-destructive" onClick={handleRevoke}>
              <Trash2 className="h-4 w-4" />
              إلغاء الرابط
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">أي شخص لديه الرابط يمكنه فتحه.</span>
          )}

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              إغلاق
            </Button>
            {!created && (
              <Button type="button" onClick={handleCreate} disabled={creating}>
                {creating ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                {target ? "إنشاء رابط" : "نسخ الرابط"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
