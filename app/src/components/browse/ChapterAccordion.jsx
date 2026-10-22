import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { db } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import ChapterFiles from "./ChapterFiles";
import LectureAccordion from "./LectureAccordion";
import SectionAccordion from "./SectionAccordion";

export default function ChapterAccordion({ chapter, info }) {
  const kind = chapter.kind || "lectures";
  const [expanded, setExpanded] = useState(false);
  const [lectures, setLectures] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (!expanded || loaded.current) return;
    if (kind === "files") {
      loaded.current = true;
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      db.filter("lectures", { chapter_id: chapter.id }).catch(() => []),
      db.filter("sections", { chapter_id: chapter.id }).catch(() => []),
    ])
      .then(([lectureData, sectionData]) => {
        if (cancelled) return;
        loaded.current = true;
        setLectures(lectureData || []);
        setSections(sectionData || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, chapter.id, kind]);

  const sortedLectures = [...lectures].sort(
    (a, b) => (a.order || 0) - (b.order || 0),
  );
  const sortedSections = [...sections].sort(
    (a, b) => (a.order || 0) - (b.order || 0),
  );
  const isEmpty = sortedLectures.length === 0 && sortedSections.length === 0;

  return (
    <div
      className="rounded-lg overflow-hidden mb-2"
      style={{ border: "1px solid hsla(190,100%,50%,0.15)" }}
    >
      <button
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <BookOpen
          size={15}
          style={{ color: info.color }}
          className="flex-shrink-0"
        />
        <span className="flex-1 text-sm font-semibold text-foreground truncate">
          {chapter.title}
        </span>
        {expanded ? (
          <ChevronUp size={14} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={14} className="text-muted-foreground" />
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
            <div
              className="px-4 pb-3 space-y-2 border-t"
              style={{ borderColor: "hsla(190,100%,50%,0.1)" }}
            >
              {loading ? (
                <div className="space-y-1 pt-2">
                  {[1, 2].map((item) => (
                    <Skeleton key={item} className="h-8 bg-muted rounded" />
                  ))}
                </div>
              ) : kind === "files" ? (
                <ChapterFiles chapterId={chapter.id} info={info} />
              ) : (
                <div className="pt-2 space-y-1">
                  {sortedLectures.map((lecture) => (
                    <LectureAccordion
                      key={lecture.id}
                      lecture={lecture}
                      info={info}
                    />
                  ))}
                  {sortedSections.length > 0 && sortedLectures.length > 0 && (
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 pt-2 px-1">
                      Sections
                    </p>
                  )}
                  {sortedSections.map((section, index) => (
                    <SectionAccordion
                      key={section.id}
                      section={section}
                      index={index}
                    />
                  ))}
                  <ChapterFiles
                    chapterId={chapter.id}
                    info={info}
                    hideWhenEmpty={!isEmpty}
                    showHeading={!isEmpty}
                    emptyLabel="No content yet."
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
