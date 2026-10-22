import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { db } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import ItemRow from "./ItemRow";

const SECTION_COLOR = "hsl(280,60%,65%)";

export default function SectionItems({ sectionId }) {
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
    db.filter("section_items", { section_id: sectionId })
      .then((data) => {
        if (!cancelled) setItems(data || []);
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
  }, [sectionId, user]);

  if (!user) {
    return (
      <div className="ml-2 mt-2">
        <Link
          to="/login"
          state={{ from: location }}
          className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition-colors"
          style={{
            borderColor: "hsla(280,60%,65%,0.3)",
            color: SECTION_COLOR,
          }}
        >
          <Lock size={12} />
          <span>سجّل دخولك لمشاهدة محتوى السكشن</span>
        </Link>
      </div>
    );
  }

  if (loading) {
    return <Skeleton className="h-6 w-full bg-muted rounded mt-1" />;
  }

  if (!items.length) {
    return (
      <p className="text-xs text-muted-foreground italic ml-2">No items yet.</p>
    );
  }

  return (
    <div className="ml-2 mt-1 space-y-1">
      {[...items]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((item) => (
          <ItemRow key={item.id} item={item} color={SECTION_COLOR} kind="section" />
        ))}
    </div>
  );
}
