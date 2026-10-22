import { useMemo, useState } from 'react';
import { BookOpen, Download, ExternalLink, Plus, Share2, Trash2, X } from 'lucide-react';
import { MaterialTypeIcon } from '@/components/material/MaterialTypeIcon';
import { materialFromSavedItem } from '@/components/material/types';
import { useMaterialViewer } from '@/components/material/MaterialViewerProvider';
import { useSavedLists } from '@/hooks/useSavedLists';
import { useSavedItems } from '@/hooks/useSavedItems';
import { Button } from '@/components/ui/button';
import { ShareListDialog } from '@/components/share/ShareListDialog';
import { ExportListDialog } from '@/components/share/ExportListDialog';
import { SearchAndAddDialog } from '@/components/user/SearchAndAddDialog';
import { toast } from 'sonner';
import { cn, formatBytes } from '@/lib/utils';
import { safeHttpUrl } from '@/lib/materialPreview';
import type { SavedItem } from '@/types/user';

interface SavedListViewProps {
  listId: string;
  onClose?: () => void;
  onChanged?: () => void;
}

function getItemTitle(item: SavedItem) {
  if (item.content_type === 'official' && item.official_material) return item.official_material.title;
  if (item.content_type === 'personal' && item.personal_file) return item.personal_file.title;
  return item.title || item.external_url || 'رابط خارجي';
}

function getItemUrl(item: SavedItem) {
  if (item.content_type === 'official' && item.official_material) return safeHttpUrl(item.official_material.url);
  if (item.content_type === 'personal' && item.personal_file) return safeHttpUrl(item.personal_file.file_url);
  return safeHttpUrl(item.external_url);
}

function getItemFileType(item: SavedItem) {
  if (item.content_type === 'official' && item.official_material) return item.official_material.file_type;
  if (item.content_type === 'personal' && item.personal_file) return item.personal_file.file_type;
  return 'link';
}

function getItemSize(item: SavedItem) {
  return item.content_type === 'personal' ? item.personal_file?.file_size || 0 : 0;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function SavedListView({ listId, onClose, onChanged }: SavedListViewProps) {
  const { openMaterial, openShare } = useMaterialViewer();
  const { lists, loading: listsLoading } = useSavedLists();
  const { items, loading: itemsLoading, addItems, removeItem } = useSavedItems(listId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const list = lists.find((entry) => entry.id === listId);
  const loading = listsLoading && !list;

  const selectedCount = selectedIds.size;
  const allSelected = items.length > 0 && selectedIds.size === items.length;

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );

  const toggleSelection = (itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((item) => item.id)));
  };

  const handleRemove = async (itemId: string) => {
    if (!confirm('إزالة هذا العنصر من القائمة؟')) return;
    const ok = await removeItem(itemId);
    if (ok) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
      onChanged?.();
      toast.success('تمت إزالة العنصر');
    } else {
      toast.error('تعذر إزالة العنصر');
    }
  };

  const handleRemoveSelected = async () => {
    if (selectedCount === 0) return;
    if (!confirm(`إزالة ${selectedCount} عنصر من القائمة؟`)) return;

    const ids = Array.from(selectedIds);
    const results = await Promise.all(ids.map((id) => removeItem(id)));
    const success = results.filter(Boolean).length;
    setSelectedIds(new Set());
    onChanged?.();
    toast.success(`تمت إزالة ${success} عنصر`);
  };

  const handleAddItems = async (rawItems: any[]) => {
    const mapped = rawItems.map((item) => {
      if (item.type === 'personal') {
        return {
          content_type: 'personal' as const,
          personal_file_id: item.id,
          kind: 'other' as const,
          title: item.title || null,
          subject_id: item.subject_id || null,
          year: item.year || null,
          semester: item.semester || null,
          user_notes: item.user_notes || null,
        };
      }
      if (item.type === 'external') {
        return {
          content_type: 'external' as const,
          external_url: item.url,
          kind: 'other' as const,
          title: item.title || item.url,
          subject_id: item.subject_id || null,
          year: item.year || null,
          semester: item.semester || null,
          user_notes: item.user_notes || null,
        };
      }
      return {
        content_type: 'official' as const,
        official_material_id: item.id,
        kind: item.kind || 'lecture',
        title: item.title || null,
        subject_id: item.subject_id || null,
        year: item.year || null,
        semester: item.semester || null,
      };
    });

    const count = await addItems(listId, mapped);
    if (count > 0) {
      onChanged?.();
      toast.success(`تمت إضافة ${count} عنصر`);
    } else {
      toast.error('تعذر إضافة العناصر');
    }
  };

  const handleDownloadAll = () => {
    const urls = items
      .map((item) => getItemUrl(item))
      .filter((url): url is string => Boolean(url));

    if (urls.length === 0) {
      toast.error('لا توجد ملفات قابلة للتحميل');
      return;
    }

    urls.forEach((url, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.download = '';
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, index * 300);
    });
  };

  const handleExport = (format: string, options: any) => {
    const source = selectedCount > 0 ? selectedItems : items;
    const rows = source
      .filter((item) => {
        if (!options.filterByType?.length) return true;
        return options.filterByType.includes(item.content_type);
      })
      .map((item) => ({
        id: item.id,
        title: getItemTitle(item),
        content_type: item.content_type,
        kind: item.kind,
        url: options.includeFileUrls ? getItemUrl(item) : undefined,
        file_type: getItemFileType(item),
        file_size: options.includeFileSizes ? getItemSize(item) : undefined,
        notes: options.includeDescriptions ? item.user_notes : undefined,
        ...(options.includeMetadata ? { created_at: item.created_at } : {}),
      }));

    const safeName = (list?.name || 'saved-list').replace(/[^\w\u0600-\u06FF-]+/g, '-');

    if (format === 'json') {
      downloadBlob(JSON.stringify(rows, null, 2), `${safeName}.json`, 'application/json;charset=utf-8');
    } else if (format === 'md') {
      const lines = [
        `# ${list?.name || 'Saved List'}`,
        '',
        '| # | العنوان | النوع | النوع الفرعي | الرابط |',
        '|---|---------|------|--------------|--------|',
        ...rows.map(
          (row, index) =>
            `| ${index + 1} | ${row.title} | ${row.content_type} | ${row.file_type || '-'} | ${row.url || '-'} |`,
        ),
      ];
      downloadBlob(lines.join('\n'), `${safeName}.md`, 'text/markdown;charset=utf-8');
    } else {
      const headers = ['id', 'title', 'content_type', 'kind', 'url', 'file_type', 'file_size', 'notes', 'created_at'];
      const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const csv = [
        headers.join(','),
        ...rows.map((row) => headers.map((key) => escape((row as any)[key])).join(',')),
      ].join('\n');
      downloadBlob(`\ufeff${csv}`, `${safeName}.csv`, 'text/csv;charset=utf-8');
    }

    toast.success('تم تصدير القائمة');
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">جارٍ تحميل القائمة...</div>;
  }

  if (!list) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold text-foreground mb-2">القائمة غير موجودة</h2>
        <Button variant="outline" onClick={onClose}>
          العودة
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-4 p-4 border-b border-border sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground truncate">{list.name}</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {items.length} عنصر
            </span>
          </div>
          {list.description && (
            <p className="mt-1 text-sm text-muted-foreground">{list.description}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            إضافة
          </Button>
          <Button size="sm" variant="outline" onClick={() => setExportOpen(true)} disabled={items.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            تصدير
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadAll} disabled={items.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            تحميل الكل
          </Button>
          <Button size="sm" onClick={() => setShareOpen(true)}>
            <Share2 className="h-4 w-4 mr-1" />
            مشاركة
          </Button>
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {itemsLoading && items.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">جارٍ تحميل العناصر...</div>
      ) : items.length === 0 ? (
        <div className="p-10 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">لا توجد عناصر بعد</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            أضف مواد من الكتالوج أو ملفاتك الشخصية
          </p>
          <Button className="mt-4" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            إضافة مواد
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 text-sm">
            <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-border"
              />
              تحديد الكل
            </label>
            {selectedCount > 0 && (
              <button
                className="text-destructive hover:underline"
                onClick={handleRemoveSelected}
              >
                إزالة المحدد ({selectedCount})
              </button>
            )}
          </div>

          <div className="divide-y divide-border/50">
            {items.map((item) => {
              const title = getItemTitle(item);
              const url = getItemUrl(item);
              const fileType = getItemFileType(item);
              const size = getItemSize(item);

              return (
                <div
                  key={item.id}
                  className={cn(
                    'group flex items-center gap-3 p-4 transition-colors',
                    selectedIds.has(item.id) && 'bg-primary/5',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelection(item.id)}
                    className="h-4 w-4 rounded border-border"
                  />

                  <div className="flex-shrink-0 rounded-lg bg-muted p-3">
                    <MaterialTypeIcon fileType={fileType} url={url} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {url ? (
                        <button
                          type="button"
                          onClick={() => openMaterial(materialFromSavedItem(item))}
                          className="font-medium text-foreground hover:text-primary truncate block text-right"
                        >
                          {title}
                        </button>
                      ) : (
                        <span className="font-medium text-foreground truncate block">{title}</span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {item.kind || item.content_type}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="px-2 py-0.5 rounded bg-muted/50">
                        {(fileType || 'link').toUpperCase()}
                      </span>
                      {size > 0 && (
                        <>
                          <span>•</span>
                          <span>{formatBytes(size)}</span>
                        </>
                      )}
                      {item.year && (
                        <>
                          <span>•</span>
                          <span>
                            {item.year}
                            {item.semester ? ` / ${item.semester}` : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => openShare(materialFromSavedItem(item))}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-primary"
                      title="مشاركة"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-primary"
                        title="فتح"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
                      title="إزالة"
                      onClick={() => handleRemove(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <ShareListDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        listId={list.id}
        listName={list.name}
      />

      <ExportListDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        listId={list.id}
        listName={list.name}
        listItems={items}
        onExport={handleExport}
      />

      <SearchAndAddDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAddItems={handleAddItems}
        targetListId={list.id}
      />
    </div>
  );
}
