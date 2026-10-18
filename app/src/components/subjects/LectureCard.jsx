import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/api";
import ConfirmDialog from "./ConfirmDialog";
import ItemDialog from "./ItemDialog";
import ItemTypeIcon from "./ItemTypeIcon";
import HtmlViewer from "@/components/browse/HtmlViewer";
import { isHtmlItem } from "@/components/browse/ItemRow";

export default function LectureCard({ lecture, index, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [viewerItem, setViewerItem] = useState(null);

  const loadItems = useCallback(async () => {
    setItemsLoading(true);
    const data = await db.filter("lecture_items", { lecture_id: lecture.id });
    setItems(data);
    setItemsLoading(false);
  }, [lecture.id]);

  useEffect(() => {
    if (expanded) loadItems();
  }, [expanded, loadItems]);

  const handleCreateItem = async (data) => {
    await db.create("lecture_items", {
      ...data,
      lecture_id: lecture.id,
      chapter_id: lecture.chapter_id,
      subject_id: lecture.subject_id,
      order: items.length + 1,
    });
    await loadItems();
    toast.success("Item added");
    setItemDialogOpen(false);
  };

  const handleUpdateItem = async (data) => {
    await db.update("lecture_items", editingItem.id, data);
    await loadItems();
    toast.success("Item updated");
    setItemDialogOpen(false);
    setEditingItem(null);
  };

  const handleDeleteItem = async () => {
    await db.remove("lecture_items", deletingItem.id);
    await loadItems();
    toast.success("Item deleted");
    setDeletingItem(null);
  };

  const sortedItems = [...items].sort(
    (a, b) => (a.order || 0) - (b.order || 0),
  );

  return (
    <div
      className="rounded-lg border border-border/60 bg-card/50 overflow-hidden"
      style={{ borderLeft: "2px solid hsl(160, 60%, 50%)" }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-secondary bg-secondary/10 px-2 py-0.5 rounded">
            LEC {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <p className="text-foreground text-sm font-medium">
              {lecture.title}
            </p>
            {lecture.description && (
              <p className="text-muted-foreground text-xs line-clamp-1">
                {lecture.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1.5 text-muted-foreground hover:text-primary rounded"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 text-muted-foreground hover:text-destructive rounded"
          >
            <Trash2 size={12} />
          </button>
          {expanded ? (
            <ChevronUp size={14} className="text-muted-foreground ml-1" />
          ) : (
            <ChevronDown size={14} className="text-muted-foreground ml-1" />
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border/30 bg-background/20 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              Videos & Files
            </span>
            <Button
              size="sm"
              onClick={() => {
                setEditingItem(null);
                setItemDialogOpen(true);
              }}
              className="bg-secondary/20 text-secondary hover:bg-secondary/30 border border-secondary/30 h-6 text-xs px-2"
            >
              <Plus size={11} className="mr-1" /> Add
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
                    {item.url && isHtmlItem(item) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewerItem(item);
                        }}
                        className="p-1 text-muted-foreground hover:text-primary"
                        title="فتح تفاعلي"
                        aria-label={`فتح ${item.title}`}
                      >
                        <ExternalLink size={11} />
                      </button>
                    )}
                    {item.url && !isHtmlItem(item) && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-muted-foreground hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={11} />
                      </a>
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
        </div>
      )}
      <ItemDialog
        open={itemDialogOpen}
        onClose={() => {
          setItemDialogOpen(false);
          setEditingItem(null);
        }}
        editing={editingItem}
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
      />
      <HtmlViewer
        open={!!viewerItem}
        url={viewerItem?.url}
        title={viewerItem?.title}
        onClose={() => setViewerItem(null)}
      />
    </div>
  );
}
