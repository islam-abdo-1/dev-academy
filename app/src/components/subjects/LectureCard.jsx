import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
} from "lucide-react";
import ItemsManager from "./ItemsManager";

export default function LectureCard({
  lecture,
  index,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}) {
  const [expanded, setExpanded] = useState(false);

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
          {onMoveUp && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
              disabled={!canMoveUp}
              aria-label="تحريك لأعلى"
              className="p-1.5 text-muted-foreground hover:text-primary rounded disabled:opacity-30 disabled:hover:text-muted-foreground"
            >
              <ArrowUp size={12} />
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown();
              }}
              disabled={!canMoveDown}
              aria-label="تحريك لأسفل"
              className="p-1.5 text-muted-foreground hover:text-primary rounded disabled:opacity-30 disabled:hover:text-muted-foreground"
            >
              <ArrowDown size={12} />
            </button>
          )}
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
          <ItemsManager
            active={expanded}
            table="lecture_items"
            parentField="lecture_id"
            parentId={lecture.id}
            chapterId={lecture.chapter_id}
            subjectId={lecture.subject_id}
            buttonClassName="bg-secondary/20 text-secondary hover:bg-secondary/30 border-secondary/30"
          />
        </div>
      )}
    </div>
  );
}
