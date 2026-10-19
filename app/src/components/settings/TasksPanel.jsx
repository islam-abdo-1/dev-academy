import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { formatDate } from "@/lib/formatDate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MAJORS } from "@/lib/majors";

const YEAR_OPTIONS = [
  { value: "year-1", label: "Year 1" },
  { value: "year-2", label: "Year 2" },
  { value: "year-3", label: "Year 3" },
  { value: "year-4", label: "Year 4" },
];

const SEMESTER_OPTIONS = [
  { value: "sem-1", label: "الترم الأول" },
  { value: "sem-2", label: "الترم الثاني" },
];

const MAJOR_LABELS = { ai: "ذكاء اصطناعي", cybersecurity: "أمن سيبراني" };
const YEAR_LABELS = {
  "year-1": "سنة 1",
  "year-2": "سنة 2",
  "year-3": "سنة 3",
  "year-4": "سنة 4",
};
const SEMESTER_LABELS = { "sem-1": "ترم 1", "sem-2": "ترم 2" };

export default function TasksPanel({ user }) {
  const { isSuperAdmin } = useAuth();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [major, setMajor] = useState("all");
  const [year, setYear] = useState("all");
  const [semester, setSemester] = useState("all");
  const [subjectName, setSubjectName] = useState("");
  const [itemType, setItemType] = useState("");
  const [itemName, setItemName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [tasks, setTasks] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sending, setSending] = useState(false);

  const loadTasks = useCallback(async () => {
    const rows = await db.list("tasks", {
      order: "created_date",
      asc: false,
      limit: 20,
    });
    setTasks(rows);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      db.list("tasks", { order: "created_date", asc: false, limit: 20 }),
      db.list("subjects"),
    ])
      .then(([taskRows, subjectRows]) => {
        if (!active) return;
        setTasks(taskRows);
        setSubjects(subjectRows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const subjectSuggestions = useMemo(() => {
    const rows = subjects.filter(
      (subject) =>
        (major === "all" || subject.major === major) &&
        (year === "all" || subject.year === year) &&
        (semester === "all" || subject.semester === semester),
    );
    return [...new Set(rows.map((subject) => subject.name))].slice(0, 50);
  }, [subjects, major, year, semester]);

  const scopeLabel = [
    MAJOR_LABELS[major] || null,
    YEAR_LABELS[year] || null,
    SEMESTER_LABELS[semester] || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const resetForm = () => {
    setTitle("");
    setDetails("");
    setMajor("all");
    setYear("all");
    setSemester("all");
    setSubjectName("");
    setItemType("");
    setItemName("");
    setGroupName("");
    setDueDate("");
    setFormUrl("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim()) {
      toast.error("اكتب عنوان المهمة");
      return;
    }
    setSending(true);
    try {
      await db.create("tasks", {
        title: title.trim(),
        details: details.trim(),
        major: major === "all" ? "" : major,
        year: year === "all" ? "" : year,
        semester: semester === "all" ? "" : semester,
        subject_name: subjectName.trim(),
        item_type: itemType,
        item_name: itemName.trim(),
        group_name: groupName.trim(),
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        form_url: formUrl.trim(),
        created_by: user?.email || "",
      });
      resetForm();
      await loadTasks();
      toast.success("تمت إضافة المهمة ✅");
    } catch {
      toast.error("حصلت مشكلة أثناء الإضافة، حاول تاني");
    } finally {
      setSending(false);
    }
  };

  const deleteTask = async (id) => {
    await db.remove("tasks", id);
    await loadTasks();
  };

  return (
    <Card className="neon-card bg-card mb-8">
      <CardHeader>
        <CardTitle className="text-lg text-foreground flex items-center gap-2">
          <ClipboardList size={20} className="text-primary" />
          إيه المطلوب مني؟
          <span className="text-xs text-muted-foreground font-normal">
            (إضافة مهام للطلاب حسب المسار)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            placeholder="عنوان المهمة..."
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className="bg-input border-border"
          />
          <Textarea
            placeholder="التفاصيل — المطلوب تسليمه بالظبط..."
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            className="bg-input border-border min-h-[70px]"
          />
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
            <p className="text-xs text-muted-foreground font-mono mb-1">
              {"// المسار المستهدف "}
              <span className="text-primary/60">(اختياري)</span>
              {` — ${scopeLabel || "لكل الطلاب"}`}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Select value={major} onValueChange={setMajor}>
                <SelectTrigger className="bg-input border-border text-xs h-8">
                  <SelectValue placeholder="القسم" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border max-h-48">
                  <SelectItem value="all">كل الأقسام</SelectItem>
                  {MAJORS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="bg-input border-border text-xs h-8">
                  <SelectValue placeholder="السنة" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">كل السنوات</SelectItem>
                  {YEAR_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger className="bg-input border-border text-xs h-8">
                  <SelectValue placeholder="الترم" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">كل الترمات</SelectItem>
                  {SEMESTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="اسم المادة..."
                value={subjectName}
                onChange={(event) => setSubjectName(event.target.value)}
                list="task-subject-options"
                className="bg-input border-border text-xs h-8"
              />
              <datalist id="task-subject-options">
                {subjectSuggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <div className="flex items-center gap-1">
                {[
                  { id: "lecture", label: "محاضرة" },
                  { id: "section", label: "سيكشن" },
                ].map((option) => {
                  const selected = itemType === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setItemType(selected ? "" : option.id)}
                      className="flex-1 px-2 py-1.5 rounded-lg border text-xs font-semibold transition-all"
                      style={{
                        background: selected
                          ? "hsla(190,100%,50%,0.12)"
                          : "transparent",
                        borderColor: selected
                          ? "hsla(190,100%,50%,0.4)"
                          : "hsl(var(--border))",
                        color: selected
                          ? "hsl(190,100%,50%)"
                          : "hsl(var(--muted-foreground))",
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder={
                  itemType === "section"
                    ? "اسم/رقم السيكشن..."
                    : "اسم/رقم المحاضرة..."
                }
                value={itemName}
                onChange={(event) => setItemName(event.target.value)}
                className="bg-input border-border text-xs h-8"
              />
              <Input
                placeholder="رقم الجروب (اختياري)"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                className="bg-input border-border text-xs h-8"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground font-mono mb-1">
                  // الديد لاين
                </p>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="bg-input border-border text-xs h-8"
                />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-mono mb-1">
                  // فورم التسليم
                </p>
                <Input
                  placeholder="https://forms.gle/... (اختياري)"
                  value={formUrl}
                  onChange={(event) => setFormUrl(event.target.value)}
                  dir="ltr"
                  className="bg-input border-border text-xs h-8"
                />
              </div>
            </div>
          </div>
          <Button
            type="submit"
            disabled={sending || !title.trim()}
            className="w-full bg-primary text-primary-foreground hover:brightness-110 flex items-center gap-2"
          >
            <Send size={15} />
            {sending ? "جاري الإضافة..." : "إضافة المهمة 📋"}
          </Button>
        </form>
        {tasks.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground font-mono mb-3">
              {"// المهام المُضافة"}
            </p>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg p-3 border border-border flex items-start gap-3"
                  style={{ background: "hsla(190,100%,50%,0.04)" }}
                >
                  <ClipboardList
                    size={16}
                    className="text-primary flex-shrink-0 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {task.title}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                      {"📍 "}
                      {[
                        MAJOR_LABELS[task.major] || "كل الأقسام",
                        YEAR_LABELS[task.year] || "كل السنوات",
                        SEMESTER_LABELS[task.semester] || "كل الترمات",
                      ].join(" · ")}
                      {task.subject_name && ` — ${task.subject_name}`}
                      {task.item_name &&
                        ` — ${task.item_type === "section" ? "سيكشن" : "محاضرة"} ${task.item_name}`}
                      {task.group_name && ` — جروب ${task.group_name}`}
                      {task.created_by && ` — بواسطة ${task.created_by}`}
                    </p>
                    {task.due_date && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {`⏰ الديد لاين: ${formatDate(new Date(task.due_date), "MMM d, yyyy")}`}
                      </p>
                    )}
                  </div>
                  {(isSuperAdmin || task.created_by === user?.email) && (
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
