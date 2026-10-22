import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { materialFromOfficial } from "@/components/material/types";
import { useMaterialViewer } from "@/components/material/MaterialViewerProvider";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/api";
import { useAsyncGuard } from "@/lib/useAsyncGuard";
import ConfirmDialog from "./ConfirmDialog";
import ItemDialog from "./ItemDialog";
import ItemTypeIcon from "./ItemTypeIcon";
import { isPlayableMedia } from "@/lib/materialPreview";
import { fetchDriveMeta, getDriveId, hasDriveApiKey } from "@/utils/drive";

async function withDriveMeta(row, existing = null) {
  if (!row.url || row.drive_file_name) return row;
  if (!getDriveId(row.url)) {
    return { ...row, drive_file_name: null, drive_mime_type: null };
  }
  const sameUrl = Boolean(existing && existing.url === row.url);
  if (sameUrl && existing.drive_file_name) return row;

  const meta = await fetchDriveMeta(row.url);
  if (!meta) {
    return sameUrl && existing
      ? row
      : { ...row, drive_file_name: null, drive_mime_type: null };
  }
  return { ...row, drive_file_name: meta.name, drive_mime_type: meta.mimeType };
}

export default function ItemsManager({
  active,
  table,
  parentField = null,
  parentId = null,
  chapterId,
  subjectId,
  label = "Videos & Files",
  addLabel = "Add",
  buttonClassName = "",
  buttonStyle,
}) {
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const { run, busy } = useAsyncGuard();
  const { openMaterial } = useMaterialViewer();

  const loadItems = useCallback(async () => {
    setItemsLoading(true);
    let data = await db.filter(
      table,
      parentField ? { [parentField]: parentId } : { chapter_id: chapterId },
    );
    if (!parentField) data = (data || []).filter((row) => !row.lecture_id);
    let rows = data || [];
    if (hasDriveApiKey()) {
      rows = await Promise.all(
        rows.map(async (row) => {
          if (!getDriveId(row.url) || row.drive_file_name) return row;
          const meta = await fetchDriveMeta(row.url);
          if (!meta) return row;
          try {
            await db.update(table, row.id, {
              drive_file_name: meta.name,
              drive_mime_type: meta.mimeType,
            });
          } catch {
            return row;
          }
          return {
            ...row,
            drive_file_name: meta.name,
            drive_mime_type: meta.mimeType,
          };
        }),
      );
    }
    setItems(rows);
    setItemsLoading(false);
  }, [table, parentField, parentId, chapterId]);

  useEffect(() => {
    if (active) loadItems();
  }, [active, loadItems]);

  const handleCreateItem = (data) =>
    run(async () => {
      const row = {
        ...data,
        chapter_id: chapterId,
        subject_id: subjectId,
        order: items.length + 1,
      };
      if (parentField) row[parentField] = parentId;
      await db.create(table, await withDriveMeta(row));
      await loadItems();
      toast.success("Item added");
      setItemDialogOpen(false);
    });

  const handleUpdateItem = (data) =>
    run(async () => {
      await db.update(table, editingItem.id, await withDriveMeta(data, editingItem));
      await loadItems();
      toast.success("Item updated");
      setItemDialogOpen(false);
      setEditingItem(null);
    });

  const handleDeleteItem = () =>
    run(async () => {
      await db.remove(table, deletingItem.id);
      await loadItems();
      toast.success("Item deleted");
      setDeletingItem(null);
    });

  const sortedItems = [...items].sort(
    (a, b) => (a.order || 0) - (b.order || 0),
  );

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Button
          size="sm"
          onClick={() => {
            setEditingItem(null);
            setItemDialogOpen(true);
          }}
          className={`h-6 text-xs px-2 border ${buttonClassName}`}
          style={buttonStyle}
        >
          <Plus size={11} className="mr-1" /> {addLabel}
        </Button>
      </div>
      {itemsLoading ? (
        <div className="space-y-1">
          {[1, 2].map((n) => (
            <Skeleton key={n} className="h-8 bg-muted rounded" />
          ))}
        </div>
      ) : sortedItems.length === 0 ? (
        <p className="text-muted-foreground text-xs text-center py-3">
          No items yet
        </p>
      ) : (
        <div className="space-y-1">
          {sortedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 px-3 py-2 rounded bg-muted/20 group"
            >
              <ItemTypeIcon item={item} />
              <span className="text-sm text-foreground flex-1 truncate">
                {item.title}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.url && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openMaterial(
                        materialFromOfficial(
                          item,
                          table === "section_items" ? "section" : "lecture",
                        ),
                      );
                    }}
                    className="p-1 text-muted-foreground hover:text-primary"
                    title={isPlayableMedia(item) ? "تشغيل" : "معاينة"}
                    aria-label={`${isPlayableMedia(item) ? "تشغيل" : "معاينة"} ${item.title}`}
                  >
                    {isPlayableMedia(item) ? (
                      <Play size={11} />
                    ) : (
                      <ExternalLink size={11} />
                    )}
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingItem(item);
                    setItemDialogOpen(true);
                  }}
                  className="p-1 text-muted-foreground hover:text-primary"
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={() => setDeletingItem(item)}
                  className="p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ItemDialog
        open={itemDialogOpen}
        onClose={() => {
          setItemDialogOpen(false);
          setEditingItem(null);
        }}
        editing={editingItem}
        submitting={busy}
        onSubmit={(data) =>
          editingItem ? handleUpdateItem(data) : handleCreateItem(data)
        }
      />
      <ConfirmDialog
        open={!!deletingItem}
        onOpenChange={() => setDeletingItem(null)}
        title="Delete Item"
        description={`Are you sure you want to delete "${deletingItem?.title}"?`}
        onConfirm={handleDeleteItem}
        busy={busy}
      />
    </>
  );
}
