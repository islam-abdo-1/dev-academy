import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  FileText,
  Link as LinkIcon,
  LoaderCircle,
  Search,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/api";
import { searchResources, searchSubjects } from "@/lib/subjectSearch";
import { isHtmlItem } from "@/components/browse/ItemRow";

export default function SearchDialog({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ subjects: [], resources: [] });
  const [loading, setLoading] = useState(false);
  const [allSubjects, setAllSubjects] = useState([]);
  const [allResources, setAllResources] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const items = useMemo(
    () => [
      ...results.subjects.map((subject) => ({ ...subject, _type: "subject" })),
      ...results.resources.map((resource) => ({
        ...resource,
        _type: "resource",
      })),
    ],
    [results],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    const [subjects, resources] = await Promise.all([
      db.list("subjects"),
      db.list("resources"),
    ]).catch(() => [[], []]);
    setAllSubjects(subjects || []);
    setAllResources(resources || []);
    setResults({
      subjects: (subjects || []).slice(0, 5),
      resources: (resources || []).slice(0, 5),
    });
    setLoading(false);
  }, []);

  const handleSelect = (item) => {
    if (item._type === "subject") {
      navigate("/dashboard/subjects");
    } else if (item._type === "resource") {
      if (item.url && !isHtmlItem({ file_type: item.type, url: item.url }))
        window.open(item.url, "_blank");
      else navigate("/dashboard/resources");
    }
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    loadData();
    return () => clearTimeout(focusTimer);
  }, [open, loadData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const term = query.trim();
      if (!term) {
        setResults({
          subjects: allSubjects.slice(0, 5),
          resources: allResources.slice(0, 5),
        });
      } else {
        setResults({
          subjects: searchSubjects(allSubjects, term).slice(0, 5),
          resources: searchResources(allResources, term).slice(0, 5),
        });
      }
      setActiveIndex(0);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, allSubjects, allResources]);

  useEffect(() => {
    if (!open) return;
    const handler = (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, items.length - 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      }
      if (event.key === "Enter" && items[activeIndex]) {
        event.preventDefault();
        handleSelect(items[activeIndex]);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, items, activeIndex]);

  const typeIcon = (type) =>
    type === "pdf" ? (
      <FileText size={16} className="text-red-400" />
    ) : type === "link" ? (
      <LinkIcon size={16} className="text-blue-400" />
    ) : (
      <FileText size={16} className="text-muted-foreground" />
    );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 bg-card border border-border overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={18} className="text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search anything..."
            className="border-0 bg-transparent p-0 focus-visible:ring-0 text-foreground placeholder:text-muted-foreground"
          />
          {loading && (
            <LoaderCircle size={16} className="text-primary animate-spin" />
          )}
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {results.subjects.length > 0 && (
            <div className="mb-2">
              <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Subjects
              </p>
              {results.subjects.map((subject, index) => (
                <button
                  key={subject.id}
                  onClick={() => handleSelect({ ...subject, _type: "subject" })}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-left transition-colors min-h-[44px] ${
                    activeIndex === index
                      ? "bg-sidebar-accent text-primary"
                      : "text-foreground hover:bg-sidebar-accent/50"
                  }`}
                >
                  <BookOpen size={16} className="text-primary" />
                  {subject.name}
                </button>
              ))}
            </div>
          )}
          {results.resources.length > 0 && (
            <div>
              <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Resources
              </p>
              {results.resources.map((resource, index) => {
                const itemIndex = results.subjects.length + index;
                return (
                  <button
                    key={resource.id}
                    onClick={() =>
                      handleSelect({ ...resource, _type: "resource" })
                    }
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-left transition-colors min-h-[44px] ${
                      activeIndex === itemIndex
                        ? "bg-sidebar-accent text-primary"
                        : "text-foreground hover:bg-sidebar-accent/50"
                    }`}
                  >
                    {typeIcon(resource.type)}
                    {resource.title}
                  </button>
                );
              })}
            </div>
          )}
          {query && !loading && items.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No results found for "{query}" 🔍
            </div>
          )}
          {!query && items.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Start typing to search subjects & resources...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
