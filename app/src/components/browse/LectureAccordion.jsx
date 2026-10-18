import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, FolderOpen } from "lucide-react";
import LectureItems from "./LectureItems";

export default function LectureAccordion({ lecture, info }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: "hsla(190,100%,50%,0.04)",
        border: "1px solid hsla(190,100%,50%,0.1)",
      }}
    >
      <button
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors"
      >
        <FolderOpen
          size={13}
          style={{ color: info.color }}
          className="flex-shrink-0"
        />
        <span className="flex-1 text-sm text-foreground/90 truncate">
          {lecture.title}
        </span>
        {expanded ? (
          <ChevronUp size={13} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={13} className="text-muted-foreground" />
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2">
              <LectureItems lectureId={lecture.id} info={info} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
