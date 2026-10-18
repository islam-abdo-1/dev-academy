import { useCallback, useEffect, useState } from "react";
import { Megaphone, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/api";
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
import AnnouncementPreview from "@/components/settings/AnnouncementPreview";
import {
  NOTICE_TYPES,
  ROLE_BY_TARGET,
  TARGETS,
} from "@/components/settings/announcementConfig";
import { MAJORS } from "@/lib/majors";

const YEAR_OPTIONS = [
  { value: "year-1", label: "Year 1" },
  { value: "year-2", label: "Year 2" },
  { value: "year-3", label: "Year 3" },
  { value: "year-4", label: "Year 4" },
];

export default function BroadcastPanel({ user }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("info");
  const [targets, setTargets] = useState(["all"]);
  const [specificEmail, setSpecificEmail] = useState("");
  const [pathSection, setPathSection] = useState("all");
  const [pathYear, setPathYear] = useState("all");
  const [announcements, setAnnouncements] = useState([]);
  const [users, setUsers] = useState([]);
  const [sending, setSending] = useState(false);

  const buildPath = () => {
    if (pathSection === "all" && pathYear === "all") return "";
    return [pathSection, pathYear].join("_");
  };

  const loadAnnouncements = useCallback(async () => {
    const rows = await db.list("announcements", {
      order: "created_date",
      asc: false,
      limit: 20,
    });
    setAnnouncements(rows);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      db.list("announcements", {
        order: "created_date",
        asc: false,
        limit: 20,
      }),
      db.list("profiles"),
    ])
      .then(([announcementRows, userRows]) => {
        if (!active) return;
        setAnnouncements(announcementRows);
        setUsers(userRows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const toggleTarget = (id) => {
    if (id === "all") {
      setTargets(["all"]);
      return;
    }
    setTargets((current) => {
      const rest = current.filter((item) => item !== "all");
      if (rest.includes(id)) {
        const next = rest.filter((item) => item !== id);
        return next.length === 0 ? ["all"] : next;
      }
      return [...rest, id];
    });
  };

  const audience = targets.includes("specific")
    ? "specific"
    : targets.includes("all")
      ? "all"
      : "group";

  const audienceLabel = targets.includes("all")
    ? "الكل"
    : TARGETS.filter((target) => targets.includes(target.id))
        .map((target) => target.label)
        .join("، ");

  const path = buildPath();

  const resetForm = () => {
    setTitle("");
    setBody("");
    setSpecificEmail("");
    setTargets(["all"]);
    setPathSection("all");
    setPathYear("all");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !body.trim()) return;
    if (audience === "specific" && !specificEmail) {
      toast.error("اختر المستخدم المطلوب");
      return;
    }
    setSending(true);
    try {
      if (audience === "specific" && specificEmail) {
        await db.create("messages", {
          to_email: specificEmail,
          from_email: user?.email || "",
          from_name: user?.full_name || "Admin",
          subject: title,
          body,
          read: false,
          path,
        });
        resetForm();
        toast.success(`تم إرسال الرسالة إلى ${specificEmail} ✅`);
        return;
      }
      if (audience === "group") {
        const roles = targets
          .map((target) => ROLE_BY_TARGET[target])
          .filter(Boolean);
        const recipients = users.filter((item) => roles.includes(item.role));
        await Promise.all(
          recipients.map((recipient) =>
            db.create("messages", {
              to_email: recipient.email,
              from_email: user?.email || "",
              from_name: user?.full_name || "Admin",
              subject: title,
              body,
              read: false,
              path,
            }),
          ),
        );
        resetForm();
        toast.success(`تم إرسال الرسالة إلى ${recipients.length} مستخدم ✅`);
        return;
      }
      await db.create("announcements", {
        title,
        body,
        pinned: true,
        type,
        path: path || null,
        created_by: user?.email || "",
      });
      await loadAnnouncements();
      resetForm();
      toast.success("تم إرسال الإعلان لجميع المستخدمين ✅");
    } finally {
      setSending(false);
    }
  };

  const toggleAnnouncement = async (announcement) => {
    await db.update("announcements", announcement.id, {
      pinned: !announcement.pinned,
    });
    await loadAnnouncements();
  };

  const deleteAnnouncement = async (id) => {
    await db.remove("announcements", id);
    await loadAnnouncements();
  };

  return (
    <Card className="neon-card bg-card mb-8">
      <CardHeader>
        <CardTitle className="text-lg text-foreground flex items-center gap-2">
          <Megaphone size={20} className="text-primary" />
          إرسال إعلان / رسالة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {Object.entries(NOTICE_TYPES).map(([key, config]) => {
              const Icon = config.icon;
              const selected = type === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
                  style={{
                    background: selected ? config.bg : "transparent",
                    border: `1px solid ${selected ? config.border : "hsl(var(--border))"}`,
                    color: selected
                      ? config.color
                      : "hsl(var(--muted-foreground))",
                  }}
                >
                  <Icon size={12} />
                  {config.label}
                </button>
              );
            })}
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-mono mb-2">
              {"// إرسال إلى: "}
              <span className="text-primary">{audienceLabel}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {TARGETS.map((target) => {
                const Icon = target.icon;
                const selected = targets.includes(target.id);
                return (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => toggleTarget(target.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all"
                    style={{
                      background: selected ? target.bg : "transparent",
                      borderColor: selected
                        ? target.border
                        : "hsl(var(--border))",
                      color: selected
                        ? target.color
                        : "hsl(var(--muted-foreground))",
                    }}
                  >
                    <Icon size={12} />
                    {target.label}
                    {selected &&
                      target.id !== "all" &&
                      target.id !== "specific" && (
                        <span
                          className="w-1.5 h-1.5 rounded-full inline-block ml-0.5"
                          style={{ background: target.color }}
                        />
                      )}
                  </button>
                );
              })}
            </div>
          </div>
          {audience === "specific" && (
            <Select value={specificEmail} onValueChange={setSpecificEmail}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue placeholder="اختر المستخدم..." />
              </SelectTrigger>
              <SelectContent className="bg-card border-border max-h-48">
                {users.map((item) => (
                  <SelectItem key={item.id} value={item.email}>
                    {item.full_name
                      ? `${item.full_name} — ${item.email}`
                      : item.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
            <p className="text-xs text-muted-foreground font-mono mb-1">
              {"// المسار المستهدف "}
              <span className="text-primary/60">(اختياري)</span>
              {" — الرسالة تظهر في هذا المسار بس"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Select value={pathSection} onValueChange={setPathSection}>
                <SelectTrigger className="bg-input border-border text-xs h-8">
                  <SelectValue placeholder="القسم" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border max-h-48">
                  <SelectItem value="all">كل الأقسام</SelectItem>
                  {MAJORS.map((major) => (
                    <SelectItem key={major.id} value={major.id}>
                      {major.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={pathYear} onValueChange={setPathYear}>
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
            </div>
            {path && (
              <p
                className="text-xs font-mono mt-1"
                style={{ color: "hsl(190,100%,50%)" }}
              >
                {"📍 "}
                {path}
              </p>
            )}
          </div>
          <Input
            placeholder="عنوان الرسالة..."
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className="bg-input border-border"
          />
          <Textarea
            placeholder={
              audience === "all"
                ? "نص الرسالة التي ستصل لجميع المستخدمين..."
                : "نص الرسالة الخاصة..."
            }
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
            className="bg-input border-border min-h-[80px]"
          />
          {(title || body) && audience === "all" && (
            <AnnouncementPreview preview={{ title, body, type }} />
          )}
          <Button
            type="submit"
            disabled={sending || !title.trim() || !body.trim()}
            className="w-full bg-primary text-primary-foreground hover:brightness-110 flex items-center gap-2"
          >
            <Send size={15} />
            {sending
              ? "جاري الإرسال..."
              : audience === "specific"
                ? `إرسال لـ ${specificEmail || "..."}`
                : audience === "group"
                  ? `إرسال لـ ${audienceLabel} 📨`
                  : "إرسال للجميع 📢"}
          </Button>
        </form>
        {announcements.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground font-mono mb-3">
              {"// الإعلانات العامة المُرسلة"}
            </p>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {announcements.map((announcement) => {
                const config =
                  NOTICE_TYPES[announcement.type] || NOTICE_TYPES.info;
                const Icon = config.icon;
                const active = Boolean(announcement.pinned);
                return (
                  <div
                    key={announcement.id}
                    className="rounded-lg p-3 border flex items-start gap-3"
                    style={{
                      background: active ? config.bg : "hsla(0,0%,50%,0.05)",
                      borderColor: active
                        ? config.border
                        : "hsl(var(--border))",
                    }}
                  >
                    <Icon
                      size={16}
                      style={{
                        color: active
                          ? config.color
                          : "hsl(var(--muted-foreground))",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {announcement.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {announcement.body}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {announcement.created_by && (
                          <span className="text-primary">
                            {announcement.created_by} ·{" "}
                          </span>
                        )}
                        {announcement.created_date &&
                          formatDate(
                            new Date(announcement.created_date),
                            "MMM d, HH:mm",
                          )}
                      </p>
                      {announcement.path && (
                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                          {"📍 "}
                          {announcement.path}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleAnnouncement(announcement)}
                        className="px-2 py-1 rounded text-xs font-mono transition-all border"
                        style={{
                          background: active ? config.bg : "transparent",
                          borderColor: active
                            ? config.border
                            : "hsl(var(--border))",
                          color: active
                            ? config.color
                            : "hsl(var(--muted-foreground))",
                        }}
                        title={active ? "إيقاف" : "تفعيل"}
                      >
                        {active ? "ON" : "OFF"}
                      </button>
                      <button
                        onClick={() => deleteAnnouncement(announcement.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
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
