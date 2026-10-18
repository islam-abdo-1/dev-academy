import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ChevronRight, FileText, Search, X } from "lucide-react";
import { db } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { downloadHref, isHtmlItem } from "@/components/browse/ItemRow";

const MAJOR_LABELS = { ai: "AI", cybersecurity: "Cybersecurity" };
const YEAR_LABELS = {
  "year-1": "Year 1",
  "year-2": "Year 2",
  "year-3": "Year 3",
  "year-4": "Year 4",
};
const SEMESTER_LABELS = { "sem-1": "Semester 1", "sem-2": "Semester 2" };

export default function PublicSearchDialog({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const loadData = async () => {
    setLoading(true);
    const [subjectRows, resourceRows] = await Promise.all([
      db.list("subjects"),
      user ? db.list("resources") : Promise.resolve([]),
    ]).catch(() => [[], []]);
    setSubjects(subjectRows || []);
    setResources(resourceRows || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSubjects([]);
    setResources([]);
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    loadData();
    return () => clearTimeout(focusTimer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused?.focus) previouslyFocused.focus();
    };
  }, [open, onClose]);

  const term = query.trim().toLowerCase();
  const filteredSubjects = term
    ? subjects.filter(
        (subject) =>
          subject.name?.toLowerCase().includes(term) ||
          subject.description?.toLowerCase().includes(term) ||
          subject.tags?.some((tag) => tag.toLowerCase().includes(term)),
      )
    : subjects.slice(0, 6);
  const filteredResources = term
    ? resources.filter(
        (resource) =>
          resource.title?.toLowerCase().includes(term) ||
          resource.description?.toLowerCase().includes(term),
      )
    : resources.slice(0, 6);
  const hasResults =
    filteredSubjects.length > 0 || filteredResources.length > 0;

  const handleSelect = (subject) => {
    if (subject.major && subject.year && subject.semester) {
      navigate(`/${subject.major}/${subject.year}/${subject.semester}`, {
        state: { highlightSubjectId: subject.id },
      });
    } else if (subject.major && subject.year) {
      navigate(`/${subject.major}/${subject.year}`);
    } else if (subject.major) {
      navigate(`/${subject.major}`);
    } else {
      navigate("/explore");
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-start justify-center pt-20 px-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="البحث في المواد والموارد"
        className="w-full max-w-xl rounded-xl border border-border overflow-hidden shadow-2xl"
        style={{ background: "hsl(240,30%,7%)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={18} className="text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث عن مواد أو موارد..."
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground text-sm"
          />
          <button
            onClick={onClose}
            aria-label="إغلاق البحث"
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="py-6 text-center text-muted-foreground text-sm">
              جاري البحث...
            </div>
          )}

          {!loading && query && !hasResults && (
            <div className="py-6 text-center text-muted-foreground text-sm">
              {`لا توجد نتائج لـ "${query}"`}
            </div>
          )}

          {!loading && !query && subjects.length === 0 && (
            <div className="py-6 text-center text-muted-foreground text-sm">
              اكتب للبحث في المواد والموارد
            </div>
          )}

          {filteredSubjects.length > 0 && (
            <div>
              <p className="px-4 py-2 text-xs text-muted-foreground font-mono border-b border-border/30">
                المواد الدراسية
              </p>
              {filteredSubjects.map((subject) => (
                <button
                  key={subject.id}
                  onClick={() => handleSelect(subject)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/10 transition-colors text-left"
                >
                  <div className="p-1.5 rounded bg-primary/10 flex-shrink-0">
                    <BookOpen size={14} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-sm font-medium truncate">
                      {subject.name}
                    </p>
                    <p className="text-muted-foreground text-xs truncate">
                      {[
                        MAJOR_LABELS[subject.major],
                        YEAR_LABELS[subject.year],
                        SEMESTER_LABELS[subject.semester],
                      ]
                        .filter(Boolean)
                        .join(" → ")}
                    </p>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-muted-foreground flex-shrink-0"
                  />
                </button>
              ))}
            </div>
          )}

          {filteredResources.length > 0 && (
            <div>
              <p className="px-4 py-2 text-xs text-muted-foreground font-mono border-b border-border/30 mt-1">
                الموارد
              </p>
              {filteredResources.map((resource) => (
                <a
                  key={resource.id}
                  href={
                    isHtmlItem({ file_type: resource.type, url: resource.url })
                      ? downloadHref(resource)
                      : resource.url
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/10 transition-colors"
                >
                  <div className="p-1.5 rounded bg-secondary/10 flex-shrink-0">
                    <FileText size={14} className="text-secondary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-sm font-medium truncate">
                      {resource.title}
                    </p>
                    <p className="text-muted-foreground text-xs truncate">
                      {resource.description || resource.type}
                    </p>
                  </div>
                  <ChevronRight
                    size={14}
                    className="text-muted-foreground flex-shrink-0"
                  />
                </a>
              ))}
            </div>
          )}

          {!user && !loading && (
            <p className="px-4 py-3 text-center text-muted-foreground text-xs border-t border-border/30">
              الموارد الكاملة متاحة بعد تسجيل الدخول
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
