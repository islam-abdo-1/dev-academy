import { useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import {
  fetchMaterialRatingSummary,
  MATERIAL_RATING_EVENT,
  rateMaterial,
  type MaterialRatingSummary,
  type MaterialRatingType,
} from "@/lib/materialRatings";
import { cn } from "@/lib/utils";

interface RatingButtonsProps {
  materialType: MaterialRatingType;
  materialId: string;
  compact?: boolean;
  className?: string;
}

export function RatingButtons({
  materialType,
  materialId,
  compact = false,
  className,
}: RatingButtonsProps) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<MaterialRatingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      setSummary(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setSummary(null);
    fetchMaterialRatingSummary(materialType, materialId, user.id)
      .then((value) => {
        if (!cancelled) setSummary(value);
      })
      .catch(() => {
        if (!cancelled) setSummary({ likes: 0, dislikes: 0, my_vote: 0 });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [materialType, materialId, user]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          materialType: MaterialRatingType;
          materialId: string;
          summary: MaterialRatingSummary;
        }>
      ).detail;
      if (
        detail?.materialType === materialType &&
        detail?.materialId === materialId &&
        detail.summary
      ) {
        setSummary(detail.summary);
      }
    };

    window.addEventListener(MATERIAL_RATING_EVENT, handler);
    return () => window.removeEventListener(MATERIAL_RATING_EVENT, handler);
  }, [materialType, materialId]);

  if (!user) return null;

  const likes = summary?.likes ?? 0;
  const dislikes = summary?.dislikes ?? 0;
  const myVote = summary?.my_vote ?? 0;
  const disabled = loading || saving;

  const handleRate = async (value: 1 | -1) => {
    if (disabled) return;
    setSaving(true);
    try {
      setSummary(await rateMaterial(materialType, materialId, value, user.id));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "تعذّر حفظ التقييم، حاول تاني",
      );
    } finally {
      setSaving(false);
    }
  };

  const buttonClass = compact
    ? "flex items-center gap-0.5 rounded-lg p-1.5 transition-colors"
    : "flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs transition-colors";

  const countClass = compact
    ? "hidden text-[10px] font-medium sm:inline"
    : "text-xs font-medium";

  return (
    <div
      className={cn(
        "flex flex-shrink-0 items-center gap-0.5",
        disabled && "opacity-60",
        className,
      )}
      dir="rtl"
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleRate(1)}
        aria-label="إعجاب"
        aria-pressed={myVote === 1}
        title={myVote === 1 ? "إلغاء الإعجاب" : "إعجاب"}
        className={cn(
          buttonClass,
          myVote === 1
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground/60 hover:bg-white/5 hover:text-primary",
        )}
      >
        <ThumbsUp size={compact ? 12 : 15} />
        <span className={countClass}>{likes}</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => handleRate(-1)}
        aria-label="عدم إعجاب"
        aria-pressed={myVote === -1}
        title={myVote === -1 ? "إلغاء عدم الإعجاب" : "عدم إعجاب"}
        className={cn(
          buttonClass,
          myVote === -1
            ? "bg-destructive/15 text-destructive"
            : "text-muted-foreground/60 hover:bg-white/5 hover:text-destructive",
        )}
      >
        <ThumbsDown size={compact ? 12 : 15} />
        <span className={countClass}>{dislikes}</span>
      </button>
    </div>
  );
}
