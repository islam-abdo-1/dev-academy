import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarClock,
  ClipboardList,
  Link2,
  MapPin,
  Send,
  Trash2,
  Users,
} from "lucide-react";
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
  { value: "year-1", label: "السنة الأولى" },
  { value: "year-2", label: "السنة الثانية" },
  { value: "year-3", label: "السنة الثالثة" },
  { value: "year-4", label: "السنة الرابعة" },
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

function FormSection({ icon: Icon, title, hint, children }) {
  return (
    <section className="space-y-3 rounded-xl border border-border/60 bg-muted/10 p-3 sm:p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon size={14} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {hint && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {hint}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function MetaChip({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground">
      {Icon && <Icon size={10} className="shrink-0 opacity-70" />}
      {children}
    </span>
  );
}

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
        <CardTitle className="flex items-start gap-2 text-lg text-foreground">
          <ClipboardList size={20} className="mt-0.5 shrink-0 text-primary" />
          <span>
            المهام المطلوبة
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              أضف مهمة وحدد المسار والموعد، وتظهر تلقائيًا للطلاب المناسبين.
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <FormSection
            icon={ClipboardList}
            title="بيانات المهمة"
            hint="عنوان واضح وتفاصيل مختصرة تساعد الطالب يعرف المطلوب بالظبط."
          >
            <div className="space-y-2">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  عنوان المهمة
                </span>
                <Input
                  placeholder="مثال: تسليم مشروع الـ Python"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  className="bg-input border-border"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  التفاصيل
                </span>
                <Textarea
                  placeholder="اكتب المطلوب تسليمه، وأي تعليمات مهمة..."
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  className="bg-input border-border min-h-[80px]"
                />
              </label>
            </div>
          </FormSection>

          <FormSection
            icon={MapPin}
            title="المسار المستهدف"
            hint={
              scopeLabel
                ? `هتظهر لطلاب: ${scopeLabel}`
                : "اختياري — من غير تحديد هتظهر لكل الطلاب."
            }
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  القسم
                </span>
                <Select value={major} onValueChange={setMajor}>
                  <SelectTrigger className="bg-input border-border h-9 w-full text-xs">
                    <SelectValue placeholder="كل الأقسام" />
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
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  السنة
                </span>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="bg-input border-border h-9 w-full text-xs">
                    <SelectValue placeholder="كل السنوات" />
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
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  الترم
                </span>
                <Select value={semester} onValueChange={setSemester}>
                  <SelectTrigger className="bg-input border-border h-9 w-full text-xs">
                    <SelectValue placeholder="كل الترمات" />
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
              </label>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  المادة
                </span>
                <Input
                  placeholder="اسم المادة..."
                  value={subjectName}
                  onChange={(event) => setSubjectName(event.target.value)}
                  list="task-subject-options"
                  className="bg-input border-border h-9 text-sm"
                />
                <datalist id="task-subject-options">
                  {subjectSuggestions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </label>
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  نوع المحتوى
                </span>
                <div className="grid grid-cols-2 gap-2">
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
                        className="h-9 rounded-lg border px-2 text-xs font-semibold transition-all"
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
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {itemType === "section"
                    ? "اسم/رقم السيكشن"
                    : itemType === "lecture"
                      ? "اسم/رقم المحاضرة"
                      : "اسم/رقم المحاضرة أو السيكشن"}
                </span>
                <Input
                  placeholder={
                    itemType === "section"
                      ? "مثال: سيكشن 3"
                      : "مثال: محاضرة 5"
                  }
                  value={itemName}
                  onChange={(event) => setItemName(event.target.value)}
                  className="bg-input border-border h-9 text-sm"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  رقم الجروب (اختياري)
                </span>
                <Input
                  placeholder="مثال: 2"
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  className="bg-input border-border h-9 text-sm"
                />
              </label>
            </div>
          </FormSection>

          <FormSection
            icon={CalendarClock}
            title="الموعد والتسليم"
            hint="حدد آخر موعد، وأضف رابط فورم التسليم لو متاح."
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  آخر موعد (اختياري)
                </span>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="bg-input border-border h-9 text-sm"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  <Link2 size={11} />
                  فورم التسليم (اختياري)
                </span>
                <Input
                  placeholder="https://forms.gle/..."
                  value={formUrl}
                  onChange={(event) => setFormUrl(event.target.value)}
                  dir="ltr"
                  className="bg-input border-border h-9 text-sm"
                />
              </label>
            </div>
          </FormSection>

          <Button
            type="submit"
            disabled={sending || !title.trim()}
            className="flex h-10 w-full items-center gap-2 bg-primary text-primary-foreground hover:brightness-110"
          >
            <Send size={15} />
            {sending ? "جاري الإضافة..." : "إضافة المهمة"}
          </Button>
        </form>
        {tasks.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ClipboardList size={14} />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  المهام المضافة
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  آخر {tasks.length} مهمة — راجعها أو احذف غير المطلوب.
                </p>
              </div>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {tasks.map((task) => {
                const scope = [
                  MAJOR_LABELS[task.major] || "كل الأقسام",
                  YEAR_LABELS[task.year] || "كل السنوات",
                  SEMESTER_LABELS[task.semester] || "كل الترمات",
                ].join(" · ");
                const itemLabel =
                  task.item_type === "section" ? "سيكشن" : "محاضرة";
                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/30 p-3"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ClipboardList size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
                          {task.title}
                        </p>
                        {task.due_date && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            <CalendarClock size={10} />
                            {formatDate(new Date(task.due_date), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                      {task.details && (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {task.details}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <MetaChip icon={MapPin}>{scope}</MetaChip>
                        {task.subject_name && (
                          <MetaChip icon={BookOpen}>
                            {task.subject_name}
                          </MetaChip>
                        )}
                        {task.item_name && (
                          <MetaChip icon={ClipboardList}>
                            {`${itemLabel} ${task.item_name}`}
                          </MetaChip>
                        )}
                        {task.group_name && (
                          <MetaChip icon={Users}>
                            {`جروب ${task.group_name}`}
                          </MetaChip>
                        )}
                      </div>
                      {task.created_by && (
                        <p className="mt-2 text-[10px] text-muted-foreground/80">
                          بواسطة {task.created_by}
                        </p>
                      )}
                    </div>
                    {(isSuperAdmin || task.created_by === user?.email) && (
                      <button
                        onClick={() => deleteTask(task.id)}
                        aria-label="حذف المهمة"
                        className="shrink-0 p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
