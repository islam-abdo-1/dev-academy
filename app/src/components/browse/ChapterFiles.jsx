import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { db } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import ItemRow from "./ItemRow";

export default function ChapterFiles({
  chapterId,
  info,
  hideWhenEmpty = false,
  showHeading = false,
  emptyLabel = "No files yet.",
}) {
  const { user } = useAuth();
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

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
    if (hideWhenEmpty) return null;
    return (
      <p className="text-xs text-muted-foreground italic pt-2">{emptyLabel}</p>
    );
  }

  return (
    <div className="pt-1 space-y-1">
      {showHeading && (
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-1 pt-2">
          ملفات إضافية
        </p>
      )}
      {[...items]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((item) => (
          <ItemRow key={item.id} item={item} color={info.color} />
        ))}
    </div>
  );
}
