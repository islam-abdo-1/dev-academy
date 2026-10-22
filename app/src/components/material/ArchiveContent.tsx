import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArchiveReader } from "libarchive-wasm";
import { libarchiveWasm } from "libarchive-wasm";
import wasmUrl from "libarchive-wasm/dist/libarchive.wasm?url";
import {
  Download,
  FileArchive,
  FileText,
  LoaderCircle,
  Lock,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PreviewStatus } from "@/components/material/PreviewStatus";
import { MaterialTypeIcon } from "@/components/material/MaterialTypeIcon";
import { getFileExtension, isArchiveItem } from "@/lib/materialPreview";
import type { Material } from "@/components/material/types";

interface ArchiveEntry {
  pathname: string;
  size: number;
}

const MAX_ARCHIVE_BYTES = 350 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 1000;
const MAX_ENTRY_BYTES = 100 * 1024 * 1024;

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  html: "text/html",
  htm: "text/html",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  csv: "text/csv",
  py: "text/x-python",
  js: "text/javascript",
  ts: "text/typescript",
  css: "text/css",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ArchiveContent({
  material,
  renderPreview,
}: {
  material: Material;
  renderPreview: (material: Material) => ReactNode;
}) {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [entryMaterial, setEntryMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [entryLoading, setEntryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [query, setQuery] = useState("");
  const dataRef = useRef<Int8Array | null>(null);
  const activePasswordRef = useRef("");
  const blobUrlRef = useRef<string | null>(null);

  const loadArchive = async (passphrase = "") => {
    setLoading(true);
    setError(null);
    setNeedsPassword(false);
    setEntries([]);
    setSelectedPath(null);
    setEntryMaterial(null);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    try {
      const response = await fetch(material.url);
      if (!response.ok) throw new Error("fetch failed");
      const contentLength = Number(response.headers.get("content-length") || 0);
      if (contentLength > MAX_ARCHIVE_BYTES) {
        throw new Error("حجم الأرشيف أكبر من الحد المسموح للمعاينة.");
      }
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > MAX_ARCHIVE_BYTES) {
        throw new Error("حجم الأرشيف أكبر من الحد المسموح للمعاينة.");
      }
      const data = new Int8Array(buffer);
      const mod = await libarchiveWasm({ locateFile: () => wasmUrl });
      const reader = new ArchiveReader(mod, data, passphrase || undefined);

      if (!passphrase && reader.hasEncryptedData()) {
        reader.free();
        dataRef.current = data;
        setNeedsPassword(true);
        setLoading(false);
        return;
      }

      const found: ArchiveEntry[] = [];
      for (const entry of reader.entries()) {
        const pathname = entry.getPathname();
        if (!pathname || pathname.endsWith("/")) continue;
        found.push({ pathname, size: entry.getSize() });
        if (found.length >= MAX_ARCHIVE_ENTRIES) break;
      }
      reader.free();
      dataRef.current = data;
      activePasswordRef.current = passphrase;
      setEntries(found);
      if (found.length === 0) {
        setError("الأرشيف فارغ أو تالف.");
      } else {
        const first = found.find((entry) => !isArchiveItem({ url: entry.pathname, file_type: getFileExtension({ url: entry.pathname }) }));
        void openEntry(first?.pathname || found[0].pathname, passphrase);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (!passphrase && /passphrase|password|encrypted/i.test(message)) {
        setNeedsPassword(true);
      } else {
        setError("تعذر فتح الأرشيف. تأكد من أن الملف سليم وأن حجمه مناسب.");
      }
    } finally {
      setLoading(false);
    }
  };

  const openEntry = async (pathname: string, passphrase = activePasswordRef.current) => {
    const data = dataRef.current;
    if (!data) return;
    setSelectedPath(pathname);
    setEntryLoading(true);
    setEntryMaterial(null);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    try {
      const mod = await libarchiveWasm({ locateFile: () => wasmUrl });
      const reader = new ArchiveReader(mod, data, passphrase || undefined);
      let bytes: Int8Array | undefined;
      let entrySize = 0;
      for (const entry of reader.entries()) {
        if (entry.getPathname() !== pathname) continue;
        entrySize = entry.getSize();
        if (entrySize > MAX_ENTRY_BYTES) {
          reader.free();
          throw new Error("حجم الملف داخل الأرشيف أكبر من الحد المسموح للمعاينة.");
        }
        bytes = entry.readData();
        break;
      }
      reader.free();

      if (!bytes) throw new Error("تعذر قراءة الملف من الأرشيف.");
      const extension = getFileExtension({ url: pathname });
      const mimeType = MIME_TYPES[extension] || "application/octet-stream";
      const blob = new Blob([bytes as BlobPart], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;
      setEntryMaterial({
        id: `${material.id}:${pathname}`,
        source: "archive",
        title: pathname.split("/").pop() || pathname,
        url: blobUrl,
        downloadUrl: blobUrl,
        fileType: extension || null,
        mimeType,
        fileSize: entrySize,
        kind: "other",
        canDownload: true,
        canShare: false,
        canSave: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر قراءة الملف من الأرشيف.");
    } finally {
      setEntryLoading(false);
    }
  };

  useEffect(() => {
    void loadArchive();
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material.url]);

  const filteredEntries = entries.filter((entry) =>
    entry.pathname.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const totalSize = entries.reduce((total, entry) => total + entry.size, 0);

  if (needsPassword) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <form
          className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-background p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void loadArchive(password);
          }}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Lock className="h-4 w-4 text-primary" />
            الأرشيف محمي بكلمة مرور
          </div>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="كلمة مرور الأرشيف"
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || !password}>
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            فتح الأرشيف
          </Button>
        </form>
      </div>
    );
  }

  if (loading) return <PreviewStatus loading />;
  if (error && entries.length === 0) return <PreviewStatus error={error} />;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] md:grid-cols-[270px_1fr] md:grid-rows-1">
      <aside className="flex min-h-0 flex-col border-b border-border bg-muted/20 md:border-b-0 md:border-l">
        <div className="space-y-2 border-b border-border p-3">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <FileArchive className="h-3.5 w-3.5" />
              {entries.length.toLocaleString("ar-EG")} ملف
            </span>
            <span>{formatBytes(totalSize)}</span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="بحث داخل الأرشيف"
              className="h-8 pr-8 text-xs"
            />
          </div>
        </div>
        <div className="max-h-44 flex-1 overflow-y-auto p-2 md:max-h-none">
          {filteredEntries.map((entry) => {
            const extension = getFileExtension({ url: entry.pathname });
            return (
              <button
                key={entry.pathname}
                type="button"
                onClick={() => void openEntry(entry.pathname)}
                className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-right transition-colors ${
                  selectedPath === entry.pathname
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
                }`}
              >
                <MaterialTypeIcon
                  fileType={extension}
                  url={entry.pathname}
                  size={16}
                  className="shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs" dir="ltr">
                    {entry.pathname}
                  </span>
                  <span className="block text-[10px] opacity-70">{formatBytes(entry.size)}</span>
                </span>
              </button>
            );
          })}
          {filteredEntries.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">لا توجد نتائج.</p>
          )}
        </div>
      </aside>

      <section className="relative min-h-[260px] overflow-hidden">
        {entryLoading ? (
          <PreviewStatus loading />
        ) : entryMaterial ? (
          <div className="absolute inset-0">
            {renderPreview(entryMaterial)}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
            <FileText className="h-9 w-9" />
            <p className="text-sm">اختر ملفًا من الأرشيف للمعاينة.</p>
          </div>
        )}
        {entryMaterial && (
          <a
            href={entryMaterial.url}
            download={entryMaterial.title}
            className="absolute bottom-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/90 px-3 py-1.5 text-xs text-foreground shadow backdrop-blur hover:border-primary/40"
          >
            <Download className="h-3.5 w-3.5" />
            تحميل الملف
          </a>
        )}
        {error && (
          <div className="absolute inset-x-3 bottom-3 z-10 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
      </section>
    </div>
  );
}
