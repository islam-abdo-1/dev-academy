import { useEffect, useRef, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { downloadHref } from "./ItemRow";

export default function HtmlViewer({ open, url, title, onClose }) {
  const [html, setHtml] = useState(null);
  const [error, setError] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open || !url) return;
    let cancelled = false;
    setHtml(null);
    setError(false);
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error("fetch failed");
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setHtml(text);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title || "محتوى تفاعلي"}
        className="w-full max-w-4xl h-[88vh] rounded-xl border border-border overflow-hidden shadow-2xl flex flex-col"
        style={{ background: "hsl(240,30%,7%)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border flex-shrink-0">
          <p className="flex-1 text-sm text-foreground truncate">{title}</p>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 bg-white min-h-0">
          {error ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
              <p className="text-muted-foreground text-sm">
                تعذّر تحميل الملف التفاعلي
              </p>
              <a
                href={downloadHref({ url })}
                className="text-primary text-sm underline"
              >
                تحميل الملف
              </a>
            </div>
          ) : html === null ? (
            <div className="h-full flex items-center justify-center">
              <LoaderCircle size={28} className="animate-spin text-primary" />
            </div>
          ) : (
            <iframe
              title={title || "محتوى تفاعلي"}
              sandbox=""
              srcDoc={html}
              referrerPolicy="no-referrer"
              className="w-full h-full border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}
