import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  BookOpen,
  Check,
  ClipboardList,
  ExternalLink,
  FolderOpen,
  Mail,
  MapPin,
  Presentation,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { formatDate } from "@/lib/formatDate";
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
      className="flex-shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded border whitespace-nowrap"
      style={{
        background: palette.bg,
        borderColor: palette.border,
        color: palette.color,
      }}
    >
      {`⏰ ${formatDate(due, "MMM d, yyyy")}`}
      {overdue ? " · متأخر" : soon ? " · قريب" : ""}
    </span>
  );
}

function TaskChip({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
      {Icon && <Icon size={10} className="opacity-60 flex-shrink-0" />}
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
  const autoReadAttempted = useRef(new Set());
  const [filters, setFilters] = useState({
    major: "all",
    year: "all",
    semester: "all",
    group: "all",
  });
  const containerRef = useRef(null);
  const seenKey = `da-tasks-seen-v1:${userEmail || "anon"}`;

  const activeTab = isLoggedIn ? tab : "tasks";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(seenKey);
      setSeenTaskIds(new Set(raw ? JSON.parse(raw) : []));
    } catch {
      setSeenTaskIds(new Set());
    }
  }, [seenKey]);

  const markTasksSeen = useCallback(
    (taskList) => {
      setSeenTaskIds((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const task of taskList) {
          if (!next.has(task.id)) {
            next.add(task.id);
            changed = true;
          }
        }
        if (!changed) return prev;
        try {
          localStorage.setItem(
            seenKey,
            JSON.stringify([...next].slice(-300)),
          );
        } catch {
          /* storage full or blocked */
        }
        return next;
      });
    },
    [seenKey],
  );

  useEffect(() => {
    if (open && activeTab === "tasks") markTasksSeen(tasks);
  }, [open, activeTab, tasks, markTasksSeen]);

  const refreshMessages = useCallback(() => {
    if (!userEmail) return Promise.resolve();
    return db
      .filter("messages", { to_email: userEmail })
      .then((data) => setMessages(data || []))
      .catch(() => setMessages([]));
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
    if (!userEmail) return;
    refreshMessages();
    const interval = setInterval(refreshMessages, 15000);
    return () => clearInterval(interval);
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
    if (!open || !isLoggedIn || activeTab !== "messages") return;
    const unread = messages.filter(
      (message) => !message.read && !autoReadAttempted.current.has(message.id),
    );
    if (unread.length === 0) return;
    for (const message of unread) autoReadAttempted.current.add(message.id);
    Promise.all(
      unread.map((message) =>
        db.update("messages", message.id, { read: true }),
      ),
    )
      .then(() => refreshMessages())
      .catch(() => {});
  }, [open, isLoggedIn, activeTab, messages, refreshMessages]);

  useEffect(() => {
    if (!open) autoReadAttempted.current.clear();
  }, [open]);

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
  const unreadCount = sorted.filter((message) => !message.read).length;

  const markRead = async (message) => {
    if (message.read) return;
    await db.update("messages", message.id, { read: true });
    refreshMessages();
  };

  const deleteMessage = async (event, message) => {
    event.stopPropagation();
    await db.remove("messages", message.id);
    refreshMessages();
    toast.success("Message deleted");
  };

  const markAllRead = async () => {
    const unread = sorted.filter((message) => !message.read);
    await Promise.all(
      unread.map((message) =>
        db.update("messages", message.id, { read: true }),
      ),
    );
    refreshMessages();
    toast.success("All marked as read");
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
    `flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
      active
        ? "bg-primary/15 text-primary"
        : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((value) => !value)}
        aria-label="الإشعارات والمهام"
        className="relative flex items-center justify-center w-9 h-9 rounded-lg border border-border/50 text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/10 transition-all"
      >
        <Bell size={16} />
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
      </button>
      {open && (
        <div
          className="fixed inset-x-3 top-[72px] z-50 w-auto max-w-[calc(100vw-24px)] max-h-[80vh] overflow-hidden rounded-xl border border-border/50 shadow-2xl flex flex-col sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-80 sm:max-w-none sm:max-h-96"
          style={{
            background: "hsl(240,30%,6%)",
            boxShadow:
              "0 8px 40px hsla(0,0%,0%,0.6), 0 0 20px hsla(190,100%,50%,0.06)",
          }}
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30">
            <div className="flex items-center gap-1.5 min-w-0">
              {isLoggedIn ? (
                <>
                  <button
                    onClick={() => setTab("messages")}
                    className={tabClass(activeTab === "messages")}
                  >
                    <Bell size={12} /> الإشعارات
                    {unreadCount > 0 && (
                      <span className="px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setTab("tasks")}
                    className={tabClass(activeTab === "tasks")}
                  >
                    <ClipboardList size={12} /> إيه المطلوب مني؟
                    {unseenTaskCount > 0 && (
                      <span className="px-1 rounded-full bg-primary/20 text-primary text-[9px] font-bold">
                        {unseenTaskCount}
                      </span>
                    )}
                  </button>
                </>
              ) : (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <ClipboardList size={14} className="text-primary" /> إيه
                  المطلوب مني؟
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>

          {activeTab === "messages" ? (
            <>
              <div className="flex items-center justify-between px-4 py-1.5 border-b border-border/20">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {"// رسائل الإدارة"}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                  >
                    <Check size={10} /> Mark all read
                  </button>
                )}
              </div>
              <div className="overflow-y-auto flex-1">
                {sorted.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Mail size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No messages yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/20">
                    {sorted.map((message) => (
                      <div
                        key={message.id}
                        onClick={() => markRead(message)}
                        className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-primary/5"
                        style={{
                          background: message.read
                            ? "transparent"
                            : "hsla(190,100%,50%,0.04)",
                        }}
                      >
                        <div className="mt-1.5 flex-shrink-0">
                          {message.read ? (
                            <div className="w-2 h-2 rounded-full bg-muted" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-0.5">
                            <p className="text-xs font-semibold text-primary truncate">
                              {message.from_name || message.from_email}
                            </p>
                            <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
                              {new Date(
                                message.created_date,
                              ).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                              })}
                            </span>
                          </div>
                          {message.subject && (
                            <p className="text-xs font-medium text-foreground mb-0.5 truncate">
                              {message.subject}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {message.body}
                          </p>
                          {message.path && (
                            <p className="text-[10px] font-mono text-muted-foreground/80 mt-0.5 truncate">
                              {"📍 "}
                              {message.path}
                            </p>
                          )}
                        </div>
                        {(isSuperAdmin ||
                          message.from_email === userEmail) && (
                          <button
                            onClick={(event) => deleteMessage(event, message)}
                            className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 p-0.5 mt-0.5"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {isLoggedIn ? (
                <div className="px-4 py-2 border-b border-border/20">
                  <p className="text-[10px] font-mono text-muted-foreground/70">
                    {"// بتظهر لك مهام مسارك: "}
                    <span className="text-foreground/80 font-medium">
                      {profileScopeLabel}
                    </span>
                  </p>
                </div>
              ) : (
                <div className="px-3 py-2 border-b border-border/20 grid grid-cols-2 gap-2">
                  <Select
                    value={filters.major}
                    onValueChange={(value) =>
                      setFilters((current) => ({ ...current, major: value }))
                    }
                  >
                    <SelectTrigger className="bg-input border-border text-xs h-8">
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
                    <SelectTrigger className="bg-input border-border text-xs h-8">
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
                      setFilters((current) => ({ ...current, semester: value }))
                    }
                  >
                    <SelectTrigger className="bg-input border-border text-xs h-8">
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
                    <SelectTrigger className="bg-input border-border text-xs h-8">
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
              )}
              <div className="overflow-y-auto flex-1">
                {visibleTasks.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <ClipboardList
                      size={28}
                      className="mx-auto mb-2 opacity-30"
                    />
                    <p className="text-sm">
                      {isLoggedIn
                        ? "مفيش مهام مطلوبة منك حاليًا 🎉"
                        : "مفيش مهام في المسار المختار"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/20">
                    {visibleTasks.map((task) => (
                      <div
                        key={task.id}
                        className="px-4 py-3 transition-colors hover:bg-primary/5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-foreground leading-snug">
                            {task.title}
                          </p>
                          <DueChip dueDate={task.due_date} />
                        </div>
                        {task.details && (
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                            {task.details}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
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
                        {task.form_url && (
                          <a
                            href={task.form_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 mt-2 text-xs font-semibold text-primary hover:underline"
                          >
                            <ExternalLink size={12} /> فورم التسليم
                          </a>
                        )}
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
