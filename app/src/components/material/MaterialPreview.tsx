import { lazy, Suspense, useEffect, useState, type MouseEvent } from "react";
import { ExternalLink, FileQuestion, Loader2, Music } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  downloadHref,
  getPreviewKind,
  getYouTubeId,
  getYouTubePlaylistId,
  isSafeMediaUrl,
  isStorageFile,
  mediaKind,
  previewSrc,
  safeHttpUrl,
  type PreviewItem,
} from "@/lib/materialPreview";
import { parseDriveUrl, toEmbedUrl } from "@/utils/drive";
import { downloadStoredFile, fetchStoredFile } from "@/lib/storage/hfWorker";
import { PreviewStatus } from "@/components/material/PreviewStatus";
import type { Material } from "@/components/material/types";

const ArchiveContent = lazy(() =>
  import("@/components/material/ArchiveContent").then((module) => ({
    default: module.ArchiveContent,
  })),
);

function TextPreview({ material }: { material: Material }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setText(null);
    setError(null);
    fetchStoredFile(previewSrc(material), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("fetch failed");
        return response.text();
      })
      .then((value) => {
        if (!controller.signal.aborted) setText(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("تعذر تحميل محتوى الملف. جرّب فتحه في نافذة جديدة.");
        }
      });
    return () => controller.abort();
  }, [material.url, material.previewUrl]);

  if (error) return <PreviewStatus error={error} />;
  if (text === null) return <PreviewStatus loading />;

  return (
    <div className="h-full overflow-auto bg-[#0d1117]">
      <pre
        dir="ltr"
        className="min-h-full whitespace-pre-wrap break-words p-4 text-left font-mono text-[13px] leading-relaxed text-slate-200"
      >
        {text}
      </pre>
    </div>
  );
}

function HtmlPreview({ material }: { material: Material }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setHtml(null);
    setError(null);
    fetchStoredFile(material.url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("fetch failed");
        return response.text();
      })
      .then((value) => {
        if (!controller.signal.aborted) setHtml(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("تعذر تحميل صفحة HTML داخل المنصة.");
        }
      });
    return () => controller.abort();
  }, [material.url, material.previewUrl]);

  if (error) return <PreviewStatus error={error} />;
  if (html === null) return <PreviewStatus loading />;

  return (
    <iframe
      title={material.title}
      sandbox="allow-scripts"
      srcDoc={html}
      referrerPolicy="no-referrer"
      className="h-full w-full border-0 bg-white"
    />
  );
}

function ImagePreview({ material }: { material: Material }) {
  const [error, setError] = useState(false);
  if (error) return <PreviewStatus error="تعذر تحميل الصورة." />;
  return (
    <div className="flex h-full items-center justify-center overflow-auto bg-black/40 p-4">
      <img
        src={previewSrc(material)}
        alt={material.title}
        onError={() => setError(true)}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}

function AudioPreview({ material }: { material: Material }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-background to-muted/40 p-6">
      <div className="rounded-full bg-primary/10 p-6 text-primary">
        <Music className="h-14 w-14" />
      </div>
      <p className="max-w-md text-center text-sm font-medium text-foreground">{material.title}</p>
      <audio src={previewSrc(material)} controls className="w-full max-w-xl" />
    </div>
  );
}

function VideoPreview({ material }: { material: Material }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
  }, [material.url, material.previewUrl]);

  return (
    <div className="relative flex h-full items-center justify-center bg-black">
      {loading && <LoadingOverlay label="جارٍ تحميل الفيديو..." />}
      <video
        src={previewSrc(material)}
        controls
        playsInline
        onLoadedData={() => setLoading(false)}
        onError={() => setLoading(false)}
        className="max-h-full w-full bg-black"
      />
    </div>
  );
}

function LoadingOverlay({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black"
    >
      <Loader2 className="h-9 w-9 animate-spin text-primary" />
      <span className="text-xs text-white/70">{label}</span>
    </div>
  );
}

function PdfPreview({ material }: { material: Material }) {
  const src = `${previewSrc(material)}#toolbar=1&navpanes=0&view=FitH`;
  return (
    <iframe
      src={src}
      title={material.title}
      referrerPolicy="no-referrer"
      className="h-full w-full border-0 bg-white"
    />
  );
}

function OfficePreview({ material }: { material: Material }) {
  const source = previewSrc(material);
  const supported =
    source.startsWith("https://") || source.startsWith("http://");
  if (!supported) return <ExternalFallback material={material} />;
  const src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(source)}`;
  return (
    <iframe
      src={src}
      title={material.title}
      className="h-full w-full border-0 bg-white"
    />
  );
}

function DrivePreview({ material }: { material: Material }) {
  const parsed = parseDriveUrl(material.url);
  const src = toEmbedUrl(material.url);
  if (!parsed || !src) return <ExternalFallback material={material} />;
  return (
    <iframe
      src={src}
      title={material.title}
      allow="autoplay; fullscreen"
      className="h-full w-full border-0 bg-white"
    />
  );
}

function YouTubePreview({ material }: { material: Material }) {
  const videoId = getYouTubeId(material.url);
  const playlistId = getYouTubePlaylistId(material.url);
  const [loading, setLoading] = useState(true);
  const src = videoId
    ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}${
        playlistId ? `?list=${encodeURIComponent(playlistId)}` : ""
      }`
    : playlistId
      ? `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(playlistId)}`
      : "";

  useEffect(() => {
    setLoading(true);
  }, [src]);

  if (!videoId && !playlistId) return <ExternalFallback material={material} />;
  return (
    <div className="flex h-full items-center justify-center bg-black p-2 sm:p-4">
      <div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-xl bg-black">
        {loading && <LoadingOverlay label="جارٍ تحميل الفيديو..." />}
        <iframe
          src={src}
          title={material.title}
          onLoad={() => setLoading(false)}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>
    </div>
  );
}

function ExternalFallback({ material }: { material: Material }) {
  const safeUrl = safeHttpUrl(previewSrc(material));
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <FileQuestion className="h-12 w-12 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-foreground">لا يمكن عرض هذا النوع للمعاينة</p>
        <p className="mt-1 max-w-md break-all text-xs text-muted-foreground">{safeUrl || previewSrc(material)}</p>
      </div>
      {safeUrl && (
        <Button asChild>
          <a href={safeUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            فتح الرابط الخارجي
          </a>
        </Button>
      )}
    </div>
  );
}

function FallbackDownload({ material }: { material: Material }) {
  const [busy, setBusy] = useState(false);
  const href = isStorageFile(material)
    ? downloadHref(material as PreviewItem)
    : safeHttpUrl(material.downloadUrl || material.url);

  const handleDownload = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      await downloadStoredFile(href, material.title);
    } catch {
      toast.error("تعذر تحميل الملف. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <FileQuestion className="h-12 w-12 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">هذا النوع غير مدعوم للمعاينة.</p>
      {material.canDownload && href && (
        <Button asChild variant="outline">
          <a
            href={href}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleDownload}
            aria-busy={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            تحميل الملف
          </a>
        </Button>
      )}
    </div>
  );
}

export function MaterialPreview({ material }: { material: Material }) {
  const kind = getPreviewKind(material);
  const source = previewSrc(material);

  if (!material.url) return <PreviewStatus error="لا يوجد رابط لهذا العنصر." />;
  if (!isSafeMediaUrl(source)) {
    return <PreviewStatus error="رابط هذا العنصر غير صالح أو غير آمن." />;
  }
  if (kind === "archive") {
    return (
      <Suspense fallback={<PreviewStatus loading />}>
        <ArchiveContent
          material={material}
          renderPreview={(nested) => <MaterialPreview material={nested} />}
        />
      </Suspense>
    );
  }
  if (kind === "youtube") return <YouTubePreview material={material} />;
  if (kind === "drive") return <DrivePreview material={material} />;
  if (kind === "pdf") return <PdfPreview material={material} />;
  if (kind === "office") return <OfficePreview material={material} />;
  if (kind === "image") return <ImagePreview material={material} />;
  if (kind === "video") return <VideoPreview material={material} />;
  if (kind === "audio") return <AudioPreview material={material} />;
  if (kind === "html") return <HtmlPreview material={material} />;
  if (kind === "text") return <TextPreview material={material} />;
  if (kind === "onedrive" || kind === "link") {
    const media = mediaKind(material);
    if (media === "video") return <VideoPreview material={material} />;
    if (media === "audio") return <AudioPreview material={material} />;
    return <ExternalFallback material={material} />;
  }
  return <FallbackDownload material={material} />;
}

export function MaterialOpenFallback({ material }: { material: Material }) {
  if (material.url) return <ExternalFallback material={material} />;
  return <PreviewStatus error="لا يوجد رابط لهذا العنصر." />;
}
