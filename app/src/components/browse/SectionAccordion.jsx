import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import SectionItems from "./SectionItems";

const SECTION_COLOR = "hsl(280,60%,65%)";

export default function SectionAccordion({ section, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        background: "hsla(280,60%,65%,0.05)",
        border: "1px solid hsla(280,60%,65%,0.15)",
      }}
    >
      <button
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 transition-colors"
      >
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: "hsla(280,60%,65%,0.15)", color: SECTION_COLOR }}
        >
          SEC {String(index + 1).padStart(2, "0")}
        </span>
        <span className="flex-1 text-sm text-foreground/90 truncate">
          {section.title}
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
              <SectionItems sectionId={section.id} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
