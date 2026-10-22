import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle,
  CalendarDays,
  Download,
  ExternalLink,
  Eye,
  LoaderCircle,
  Share2,
  UserRound,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatBytes } from '@/lib/utils';
import {
  downloadHref,
  isStorageFile,
  isSupabaseStorageHtml,
  safeHttpUrl,
} from '@/lib/materialPreview';
import { MaterialTypeIcon } from '@/components/material/MaterialTypeIcon';
import { materialFromSharedItem } from '@/components/material/types';
import { useMaterialViewer } from '@/components/material/MaterialViewerProvider';

type SharedResourceType =
  | 'file'
  | 'list'
  | 'course'
  | 'lecture_item'
  | 'section_item'
  | 'resource'
  | 'external';

interface SharedItem {
  id: string;
  title: string;
  type: string;
  file_type?: string | null;
  url?: string | null;
  file_size?: number | null;
}

interface ShareData {
  resourceType: SharedResourceType;
  resourceId: string;
  title: string;
  description?: string | null;
  items: SharedItem[];
  permission: 'view' | 'download';
  scope?: 'all' | 'year' | 'term';
  year?: string | null;
  semester?: string | null;
  createdAt: string;
  createdBy: {
    name: string;
    avatar?: string | null;
  };
  allowComments?: boolean;
  passwordProtected?: boolean;
}

const RESOURCE_LABELS: Record<SharedResourceType, string> = {
  file: 'ملف',
  list: 'قائمة محفوظة',
  course: 'كورس',
  lecture_item: 'مادة رسمية',
  section_item: 'مادة سكشن',
  resource: 'مورد',
  external: 'رابط خارجي',
};

function formatDate(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function PublicShareView() {
  const { token } = useParams<{ token: string }>();
  const { openMaterial } = useMaterialViewer();
  const [data, setData] = useState<ShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      if (!token) {
        setError('رابط المشاركة غير صالح.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data: result, error: rpcError } = await supabase.rpc('get_shared_list', {
          p_token: token,
        });

        if (rpcError) throw rpcError;
        if (cancelled) return;

        if (!result) {
          setError('هذا الرابط غير موجود أو تم إلغاؤه.');
          setData(null);
          return;
        }

        setData(result as ShareData);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'تعذر تحميل المشاركة.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleDownload = (item: SharedItem) => {
    if (!item.url) return;
    const href = isStorageFile(item) ? downloadHref(item) : safeHttpUrl(item.url);
    if (!href) return;
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.download = item.title || 'download';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">جارٍ تحميل المشاركة...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="mx-auto max-w-md text-center">
          <AlertCircle className="mx-auto h-14 w-14 text-red-500" />
          <h1 className="mt-4 text-xl font-semibold text-foreground">تعذر فتح المشاركة</h1>
          <p className="mt-2 text-muted-foreground">{error || 'المشاركة غير متاحة.'}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            قد يكون الرابط غير صحيح أو تم إلغاء المشاركة.
          </p>
          <a
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <Share2 className="h-4 w-4" />
            العودة إلى Dev Academy
          </a>
        </div>
      </div>
    );
  }

  const heroItem = data.items?.[0];
  const downloadAllowed = data.permission === 'download';
  const canDownloadAny = downloadAllowed && data.items?.some((item) => item.url);

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <a href="/" className="flex items-center gap-2.5">
            <img
              src="/logo-mark.webp"
              alt="Dev Academy"
              className="h-9 w-9 rounded-lg object-contain"
            />
            <span className="font-semibold text-foreground">Dev Academy</span>
          </a>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
            <Eye className="h-3.5 w-3.5" />
            معاينة عامة
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="h-1.5 bg-gradient-to-l from-primary via-cyan-400 to-emerald-400" />
          <div className="p-5 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                <MaterialTypeIcon
                  fileType={heroItem?.file_type}
                  url={heroItem?.url}
                  type={heroItem?.type}
                  size={30}
                />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium text-primary">
                  {RESOURCE_LABELS[data.resourceType] || 'مشاركة'}
                </span>
                <h1 className="mt-1 break-words text-2xl font-bold text-foreground sm:text-3xl">
                  {data.title}
                </h1>
                {data.description && (
                  <p className="mt-2 leading-relaxed text-muted-foreground">{data.description}</p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <UserRound className="h-3.5 w-3.5" />
                    {data.createdBy?.name || 'مستخدم'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDate(data.createdAt)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    {downloadAllowed ? 'عرض وتحميل' : 'عرض فقط'}
                  </span>
                  {(data.year || data.semester) && (
                    <span>{[data.year, data.semester].filter(Boolean).join(' - ')}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground">المحتوى المشترك</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.items?.length || 0} عنصر
              </p>
            </div>
            {canDownloadAny && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => data.items.forEach((item) => item.url && handleDownload(item))}
              >
                <Download className="h-4 w-4" />
                تحميل الكل
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
            {data.items?.map((item) => {
              const safeItemUrl = safeHttpUrl(item.url);
              const canPreview = Boolean(safeItemUrl);
              return (
                <div
                  key={item.id}
                  className="group flex items-center gap-3 border-b border-border/50 p-4 last:border-b-0 hover:bg-accent/30"
                >
                  <div className="flex-shrink-0 rounded-lg bg-muted p-3">
                    <MaterialTypeIcon
                      fileType={item.file_type}
                      url={item.url}
                      type={item.type}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    {canPreview ? (
                      <button
                        type="button"
                        onClick={() =>
                          openMaterial(materialFromSharedItem(item, data.permission))
                        }
                        className="block max-w-full truncate text-right font-medium text-foreground hover:text-primary"
                      >
                        {item.title}
                      </button>
                    ) : (
                      <span className="block truncate font-medium text-foreground">{item.title}</span>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded bg-muted/70 px-1.5 py-0.5">
                        {(item.file_type || item.type || 'FILE').toUpperCase()}
                      </span>
                      {item.file_size ? <span>{formatBytes(item.file_size)}</span> : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    {canPreview && (
                      <button
                        type="button"
                        onClick={() =>
                          openMaterial(materialFromSharedItem(item, data.permission))
                        }
                        className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-primary"
                        title="معاينة"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    {canPreview && !isSupabaseStorageHtml(item) && (
                      <a
                        href={safeItemUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-primary"
                        title="فتح في نافذة جديدة"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    {downloadAllowed && canPreview && (
                      <button
                        type="button"
                        onClick={() => handleDownload(item)}
                        className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-primary"
                        title="تحميل"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {data.items?.length === 0 && (
              <div className="px-6 py-14 text-center text-muted-foreground">
                لا توجد عناصر في هذه المشاركة.
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="mt-12 border-t border-border/60">
        <div className="mx-auto max-w-5xl px-4 py-7 text-center text-sm text-muted-foreground">
          <p>تم إنشاء المنصة بواسطة 𝘌𝘕𝘎. 𝐼𝑠𝑙𝑎𝑚 𝐴𝑏𝑑𝑜</p>
          <p className="mt-1 text-xs">Dev Academy</p>
        </div>
      </footer>
    </div>
  );
}
