import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  BookOpen,
  CheckCheck,
  ClipboardList,
  Clock,
  ExternalLink,
  FolderOpen,
  Inbox,
  ListChecks,
  Mail,
  MapPin,
  Presentation,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { formatDate } from "@/lib/formatDate";
import { safeHttpUrl } from "@/lib/materialPreview";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAJOR_LABELS = { ai: "ذكاء اصطناعي", cybersecurity: "أمن سيبراني" };
const YEAR_LABELS = {
  "year-1": "سنة 1",
  "year-2": "سنة 2",
  "year-3": "سنة 3",
  "year-4": "سنة 4",
};
const SEMESTER_LABELS = { "sem-1": "ترم 1", "sem-2": "ترم 2" };

const scopeMatches = (value, current) =>
  !value || !current || value === current;

function filterTasks(tasks, { major, year, semester, group }) {
  return tasks.filter(
    (task) =>
      scopeMatches(task.major, major) &&
      scopeMatches(task.year, year) &&
      scopeMatches(task.semester, semester) &&
      scopeMatches(task.group_name, group),
  );
}

function sortTasks(a, b) {
  const at = a.due_date ? new Date(a.due_date).getTime() : Infinity;
  const bt = b.due_date ? new Date(b.due_date).getTime() : Infinity;
  if (at !== bt) return at - bt;
  return new Date(b.created_date) - new Date(a.created_date);
}

function DueChip({ dueDate }) {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = Date.now();
  const overdue = due.getTime() < now;
  const soon = !overdue && due.getTime() - now < 3 * 24 * 60 * 60 * 1000;
  const palette = overdue
    ? {
        bg: "hsla(0,84%,60%,0.12)",
        border: "hsla(0,84%,60%,0.4)",
        color: "hsl(0,84%,60%)",
      }
    : soon
      ? {
          bg: "hsla(38,100%,55%,0.12)",
          border: "hsla(38,100%,55%,0.4)",
          color: "hsl(38,100%,55%)",
        }
      : {
          bg: "hsla(0,0%,50%,0.08)",
          border: "hsl(var(--border))",
          color: "hsl(var(--muted-foreground))",
        };
  return (
    <span
      className="inline-flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px]"
      style={{
        background: palette.bg,
        borderColor: palette.border,
        color: palette.color,
      }}
    >
      <Clock size={10} className="shrink-0" />
      {formatDate(due, "MMM d, yyyy")}
      {overdue ? " · متأخر" : soon ? " · قريب" : ""}
    </span>
  );
}

function TaskChip({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground">
      {Icon && <Icon size={10} className="shrink-0 opacity-70" />}
      {children}
    </span>
  );
}

export default function NotificationBell({ userEmail }) {
  const { profile, isSuperAdmin } = useAuth();
  const isLoggedIn = Boolean(userEmail);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("messages");
  const [messages, setMessages] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [seenTaskIds, setSeenTaskIds] = useState(() => new Set());
  const [filters, setFilters] = useState({
    major: "all",
    year: "all",
    semester: "all",
    group: "all",
  });
  const containerRef = useRef(null);
  const messagesRequestRef = useRef(0);
  const profileId = profile?.id || null;
  const anonSeenKey = "da-tasks-seen-v1:anon";

  const activeTab = isLoggedIn ? tab : "tasks";

  useEffect(() => {
    if (isLoggedIn && profileId) {
      let active = true;
      supabase
        .from("task_reads")
        .select("task_id")
        .limit(500)
        .then(({ data }) => {
          if (!active) return;
          setSeenTaskIds(
            new Set(Array.isArray(data) ? data.map((row) => row.task_id) : []),
          );
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }
    try {
      const raw = localStorage.getItem(anonSeenKey);
      setSeenTaskIds(new Set(raw ? JSON.parse(raw) : []));
    } catch {
      setSeenTaskIds(new Set());
    }
  }, [isLoggedIn, profileId, anonSeenKey]);

  const markTasksSeen = useCallback(
    (taskList) => {
      setSeenTaskIds((prev) => {
        const next = new Set(prev);
        const added = [];
        for (const task of taskList) {
          if (!next.has(task.id)) {
            next.add(task.id);
            added.push(task.id);
          }
        }
        if (added.length === 0) return prev;
        if (isLoggedIn && profileId) {
          supabase
            .from("task_reads")
            .upsert(
              added.map((taskId) => ({
                profile_id: profileId,
                task_id: taskId,
              })),
              { onConflict: "profile_id,task_id", ignoreDuplicates: true },
            )
            .then(() => {});
        } else {
          try {
            localStorage.setItem(
              anonSeenKey,
              JSON.stringify([...next].slice(-300)),
            );
          } catch {
            /* storage full or blocked */
          }
        }
        return next;
      });
    },
    [isLoggedIn, profileId, anonSeenKey],
  );

  useEffect(() => {
    if (open && activeTab === "tasks") markTasksSeen(tasks);
  }, [open, activeTab, tasks, markTasksSeen]);

  const refreshMessages = useCallback(() => {
    if (!userEmail) {
      messagesRequestRef.current += 1;
      setMessages([]);
      return Promise.resolve();
    }

    const requestId = ++messagesRequestRef.current;
    return db
      .filter(
        "messages",
        { to_email: userEmail },
        { order: "created_date", asc: false, limit: 200 },
      )
      .then((data) => {
        if (requestId !== messagesRequestRef.current) return;
        if (Array.isArray(data)) setMessages(data);
      })
      .catch(() => {});
  }, [userEmail]);

  const refreshTasks = useCallback(
    () =>
      db
        .list("tasks", { order: "created_date", asc: false, limit: 100 })
        .then((data) => setTasks(data || []))
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    if (!userEmail) {
      messagesRequestRef.current += 1;
      setMessages([]);
      return;
    }
    refreshMessages();
    const interval = setInterval(refreshMessages, 15000);
    return () => {
      clearInterval(interval);
      messagesRequestRef.current += 1;
    };
  }, [userEmail, refreshMessages]);

  useEffect(() => {
    refreshTasks();
    const interval = setInterval(refreshTasks, 60000);
    return () => clearInterval(interval);
  }, [refreshTasks]);

  useEffect(() => {
    if (open) refreshTasks();
  }, [open, refreshTasks]);

  useEffect(() => {
    const handler = (event) => {
      const target = event.target;
      if (
        target.closest &&
        target.closest(
          '[data-radix-popper-content-wrapper], [role="listbox"], [role="option"]',
        )
      )
        return;
      if (containerRef.current && !containerRef.current.contains(target))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const sorted = [...messages].sort(
    (a, b) => new Date(b.created_date) - new Date(a.created_date),
  );
  const unreadMessages = sorted.filter((message) => !message.read);
  const readMessages = sorted.filter((message) => message.read);
  const unreadCount = unreadMessages.length;

  const markRead = async (message) => {
    if (message.read) return;
    setMessages((current) =>
      current.map((item) =>
        item.id === message.id ? { ...item, read: true } : item,
      ),
    );
    try {
      await db.update("messages", message.id, { read: true });
    } catch {
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id ? { ...item, read: false } : item,
        ),
      );
      toast.error("تعذر تحديث حالة الإشعار");
    }
  };

  const deleteMessage = async (event, message) => {
    event.stopPropagation();
    const previous = messages;
    setMessages((current) => current.filter((item) => item.id !== message.id));
    try {
      await db.remove("messages", message.id);
      toast.success("تم حذف الإشعار");
    } catch {
      setMessages(previous);
      toast.error("تعذر حذف الإشعار");
    }
  };

  const markAllRead = async () => {
    if (unreadMessages.length === 0) return;
    const unreadIds = new Set(unreadMessages.map((message) => message.id));
    setMessages((current) =>
      current.map((item) =>
        unreadIds.has(item.id) ? { ...item, read: true } : item,
      ),
    );
    const results = await Promise.allSettled(
      unreadMessages.map((message) =>
        db.update("messages", message.id, { read: true }),
      ),
    );
    if (results.some((result) => result.status === "rejected")) {
      refreshMessages();
      toast.error("تعذر تحديد بعض الإشعارات كمقروءة");
      return;
    }
    toast.success("تم تحديد كل الإشعارات كمقروءة");
  };

  const scope = isLoggedIn
    ? {
        major: profile?.major || "",
        year: profile?.year || "",
        semester: profile?.semester || "",
      }
    : {
        major: filters.major === "all" ? "" : filters.major,
        year: filters.year === "all" ? "" : filters.year,
        semester: filters.semester === "all" ? "" : filters.semester,
        group: filters.group === "all" ? "" : filters.group,
      };
  const groupOptions = [
    ...new Set(tasks.map((task) => task.group_name).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "ar", { numeric: true }));
  const visibleTasks = filterTasks(tasks, scope).sort(sortTasks);
  const profileScopeLabel =
    [
      MAJOR_LABELS[profile?.major],
      YEAR_LABELS[profile?.year],
      SEMESTER_LABELS[profile?.semester],
    ]
      .filter(Boolean)
      .join(" · ") || "كل المسارات";
  const unseenTaskCount = visibleTasks.filter(
    (task) => !seenTaskIds.has(task.id),
  ).length;
  const badgeCount = unreadCount + unseenTaskCount;

  const tabClass = (active) =>
    `flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 text-[11px] font-semibold transition-colors ${
      active
        ? "bg-primary/15 text-primary shadow-sm"
        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
    }`;

  const renderMessage = (message) => (
    <div
      key={message.id}
      onClick={() => markRead(message)}
      className={`flex items-start gap-3 border-b border-border/20 px-4 py-3 transition-colors hover:bg-primary/5 ${
        message.read ? "" : "cursor-pointer bg-primary/[0.04]"
      }`}
    >
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          message.read
            ? "bg-muted/40 text-muted-foreground"
            : "bg-primary/15 text-primary"
        }`}
      >
        <Mail size={13} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 truncate text-[11px] font-semibold text-primary">
            {message.from_name || message.from_email}
          </p>
          {!message.read && (
            <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
              جديد
            </span>
          )}
          {message.created_date && (
            <span
              className="ml-auto shrink-0 text-[10px] text-muted-foreground"
              dir="ltr"
            >
              {formatDate(new Date(message.created_date), "MMM d")}
            </span>
          )}
        </div>
        {message.subject && (
          <p className="mt-0.5 truncate text-xs font-medium text-foreground">
            {message.subject}
          </p>
        )}
        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {message.body}
        </p>
        {message.path && (
          <div className="mt-1.5">
            <TaskChip icon={MapPin}>{message.path}</TaskChip>
          </div>
        )}
      </div>
      {(isSuperAdmin || message.from_email === userEmail) && (
        <button
          onClick={(event) => deleteMessage(event, message)}
          aria-label="حذف الإشعار"
          className="mt-0.5 shrink-0 p-0.5 text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((value) => !value)}
        aria-label={`الإشعارات والمهام${badgeCount > 0 ? ` (${badgeCount > 99 ? "99+" : badgeCount})` : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
      >
        <Bell size={16} />
        {badgeCount > 0 && (
          <span
            aria-hidden="true"
            dir="ltr"
            className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground ring-2 ring-background"
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        )}
      </button>
      {open && (
        <div
          className="fixed inset-x-3 top-[72px] z-50 flex max-h-[80vh] w-auto max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-xl border border-border/50 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:max-h-[540px] sm:w-[380px] sm:max-w-none"
          style={{
            background: "hsl(240,30%,6%)",
            boxShadow:
              "0 8px 40px hsla(0,0%,0%,0.6), 0 0 20px hsla(190,100%,50%,0.06)",
          }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border/30 px-3 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bell size={15} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {isLoggedIn ? "التنبيهات" : "إيه المطلوب مني؟"}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {isLoggedIn
                    ? "الإشعارات والمهام في مكان واحد"
                    : "مهام المسار المختار"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="إغلاق التنبيهات"
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>

          {isLoggedIn && (
            <div className="border-b border-border/30 px-3 py-2">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/30 p-1">
                <button
                  onClick={() => setTab("messages")}
                  className={tabClass(activeTab === "messages")}
                  aria-pressed={activeTab === "messages"}
                >
                  <Bell size={12} />
                  الإشعارات
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-destructive px-1.5 text-[9px] font-bold text-destructive-foreground">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setTab("tasks")}
                  className={tabClass(activeTab === "tasks")}
                  aria-pressed={activeTab === "tasks"}
                >
                  <ListChecks size={12} />
                  إيه المطلوب مني؟
                  {unseenTaskCount > 0 && (
                    <span className="rounded-full bg-primary/20 px-1.5 text-[9px] font-bold text-primary">
                      {unseenTaskCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}

          {activeTab === "messages" ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-border/20 px-4 py-2">
                <div>
                  <p className="text-[11px] font-medium text-foreground">
                    رسائل الإدارة
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {unreadCount > 0
                      ? `${unreadCount} غير مقروءة`
                      : "كل الرسائل مقروءة"}
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-primary"
                  >
                    <CheckCheck size={11} />
                    تحديد الكل
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {sorted.length === 0 ? (
                  <div className="flex flex-col items-center px-5 py-12 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/30 text-muted-foreground">
                      <Inbox size={22} />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-foreground">
                      لا توجد إشعارات
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      أي رسالة جديدة من الإدارة هتظهر هنا.
                    </p>
                  </div>
                ) : (
                  <div>
                    {unreadMessages.length > 0 && (
                      <div>
                        <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          جديدة
                        </p>
                        {unreadMessages.map(renderMessage)}
                      </div>
                    )}
                    {readMessages.length > 0 && (
                      <div>
                        <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          مقروءة
                        </p>
                        {readMessages.map(renderMessage)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {isLoggedIn ? (
                <div className="border-b border-border/20 px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <MapPin size={11} className="shrink-0 text-primary" />
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        مهام مسارك
                      </span>
                      <span className="truncate text-[11px] font-medium text-foreground">
                        {profileScopeLabel}
                      </span>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {visibleTasks.length}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="border-b border-border/20 p-3">
                  <p className="mb-2 text-[10px] font-semibold text-muted-foreground">
                    اختار مسارك
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={filters.major}
                      onValueChange={(value) =>
                        setFilters((current) => ({ ...current, major: value }))
                      }
                    >
                      <SelectTrigger className="h-8 w-full bg-input text-xs">
                        <SelectValue placeholder="القسم" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="all">كل الأقسام</SelectItem>
                        <SelectItem value="ai">ذكاء اصطناعي</SelectItem>
                        <SelectItem value="cybersecurity">أمن سيبراني</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={filters.year}
                      onValueChange={(value) =>
                        setFilters((current) => ({ ...current, year: value }))
                      }
                    >
                      <SelectTrigger className="h-8 w-full bg-input text-xs">
                        <SelectValue placeholder="السنة" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="all">كل السنوات</SelectItem>
                        <SelectItem value="year-1">سنة 1</SelectItem>
                        <SelectItem value="year-2">سنة 2</SelectItem>
                        <SelectItem value="year-3">سنة 3</SelectItem>
                        <SelectItem value="year-4">سنة 4</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={filters.semester}
                      onValueChange={(value) =>
                        setFilters((current) => ({
                          ...current,
                          semester: value,
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 w-full bg-input text-xs">
                        <SelectValue placeholder="الترم" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="all">كل الترمات</SelectItem>
                        <SelectItem value="sem-1">ترم 1</SelectItem>
                        <SelectItem value="sem-2">ترم 2</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={filters.group}
                      onValueChange={(value) =>
                        setFilters((current) => ({ ...current, group: value }))
                      }
                    >
                      <SelectTrigger className="h-8 w-full bg-input text-xs">
                        <SelectValue placeholder="الجروب" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border max-h-48">
                        <SelectItem value="all">كل الجروبات</SelectItem>
                        {groupOptions.map((group) => (
                          <SelectItem key={group} value={group}>
                            {`جروب ${group}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-y-auto">
                {visibleTasks.length === 0 ? (
                  <div className="flex flex-col items-center px-5 py-12 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/30 text-muted-foreground">
                      <ClipboardList size={22} />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-foreground">
                      {isLoggedIn ? "مفيش مهام مطلوبة منك حاليًا" : "مفيش مهام"}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {isLoggedIn
                        ? "أي مهمة جديدة تخص مسارك هتظهر هنا."
                        : "جرّب تغيّر المسار المختار."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 p-3">
                    {visibleTasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-xl border border-border/70 bg-background/30 p-3"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            aria-hidden="true"
                            className="mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 border-primary/35 bg-primary/5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
                                {task.title}
                              </p>
                              <DueChip dueDate={task.due_date} />
                            </div>
                            {task.details && (
                              <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                                {task.details}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {!isLoggedIn &&
                                (task.major || task.year || task.semester) && (
                                  <TaskChip icon={MapPin}>
                                    {[
                                      MAJOR_LABELS[task.major],
                                      YEAR_LABELS[task.year],
                                      SEMESTER_LABELS[task.semester],
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </TaskChip>
                                )}
                              {task.subject_name && (
                                <TaskChip icon={BookOpen}>
                                  {task.subject_name}
                                </TaskChip>
                              )}
                              {task.item_name && (
                                <TaskChip
                                  icon={
                                    task.item_type === "section"
                                      ? FolderOpen
                                      : Presentation
                                  }
                                >
                                  {task.item_type === "section"
                                    ? `سيكشن ${task.item_name}`
                                    : task.item_type === "lecture"
                                      ? `محاضرة ${task.item_name}`
                                      : task.item_name}
                                </TaskChip>
                              )}
                              {task.group_name && (
                                <TaskChip icon={Users}>
                                  {`جروب ${task.group_name}`}
                                </TaskChip>
                              )}
                            </div>
                            {safeHttpUrl(task.form_url) && (
                              <a
                                href={safeHttpUrl(task.form_url)}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15"
                              >
                                فتح فورم التسليم
                                <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
