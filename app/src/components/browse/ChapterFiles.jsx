import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { db } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import HtmlViewer from "./HtmlViewer";
import MediaViewer from "./MediaViewer";
import ItemRow from "./ItemRow";

export default function ChapterFiles({ chapterId, info }) {
  const { user } = useAuth();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewerItem, setViewerItem] = useState(null);
  const [mediaItem, setMediaItem] = useState(null);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    db.filter("lecture_items", { chapter_id: chapterId })
      .then((data) => {
        if (!cancelled)
          setItems((data || []).filter((row) => !row.lecture_id));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chapterId, user]);

  if (!user) {
    return (
      <div className="pt-2">
        <Link
          to="/login"
          state={{ from: location }}
          className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
        >
          <Lock size={12} />
          <span>سجّل دخولك لمشاهدة المحتوى</span>
        </Link>
      </div>
    );
  }

  if (loading) {
    return <Skeleton className="h-6 w-full bg-muted rounded mt-2" />;
  }

  if (!items.length) {
    return (
      <p className="text-xs text-muted-foreground italic pt-2">No files yet.</p>
    );
  }

  return (
    <div className="pt-1 space-y-1">
      {[...items]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            color={info.color}
            onOpenHtml={setViewerItem}
            onOpenMedia={setMediaItem}
          />
        ))}
      <HtmlViewer
        open={!!viewerItem}
        url={viewerItem?.url}
        title={viewerItem?.title}
        onClose={() => setViewerItem(null)}
      />
      <MediaViewer
        open={!!mediaItem}
        item={mediaItem}
        onClose={() => setMediaItem(null)}
      />
    </div>
  );
}
