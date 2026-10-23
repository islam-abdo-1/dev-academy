import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  Mail,
  MapPin,
  Megaphone,
  MessageSquare,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/api";
import { supabase } from "@/lib/supabase";
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
import AnnouncementPreview from "@/components/settings/AnnouncementPreview";
import {
  NOTICE_TYPES,
  ROLE_BY_TARGET,
  TARGETS,
} from "@/components/settings/announcementConfig";
import { MAJORS } from "@/lib/majors";

const YEAR_OPTIONS = [
  { value: "year-1", label: "السنة الأولى" },
  { value: "year-2", label: "السنة الثانية" },
  { value: "year-3", label: "السنة الثالثة" },
  { value: "year-4", label: "السنة الرابعة" },
];

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

export default function BroadcastPanel({ user }) {
  const { isSuperAdmin } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("info");
  const [targets, setTargets] = useState(["all"]);
  const [specificEmail, setSpecificEmail] = useState("");
  const [pathSection, setPathSection] = useState("all");
  const [pathYear, setPathYear] = useState("all");
  const [announcements, setAnnouncements] = useState([]);
  const [sentMessages, setSentMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const broadcastRef = useRef({ fingerprint: "", id: "" });

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
      db.list("messages", { order: "created_date", asc: false, limit: 100 }),
    ])
      .then(([announcementRows, userRows, messageRows]) => {
        if (!active) return;
        setAnnouncements(announcementRows);
        setUsers(userRows);
        setSentMessages(messageRows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const loadSentMessages = useCallback(async () => {
    const rows = await db.list("messages", {
      order: "created_date",
      asc: false,
      limit: 100,
    });
    setSentMessages(rows);
  }, []);

  const staffEmails = useMemo(
    () =>
      new Set(
        users
          .filter(
            (item) => item.role === "admin" || item.role === "super_admin",
          )
          .map((item) => item.email),
      ),
    [users],
  );

  const sentBatches = useMemo(() => {
    const visible = sentMessages.filter((message) =>
      isSuperAdmin
        ? staffEmails.has(message.from_email)
        : message.from_email === user?.email,
    );
    const groups = new Map();
    for (const message of visible) {
      const minute = new Date(message.created_date).toISOString().slice(0, 16);
      const key = `${message.from_email}|${message.subject}|${message.path || ""}|${minute}`;
      const existing = groups.get(key);
      if (existing) {
        existing.ids.push(message.id);
      } else {
        groups.set(key, {
          key,
          ids: [message.id],
          from_email: message.from_email,
          subject: message.subject,
          path: message.path,
          created_date: message.created_date,
        });
      }
    }
    return [...groups.values()].slice(0, 10);
  }, [sentMessages, isSuperAdmin, staffEmails, user?.email]);

  const deleteBatch = async (batch) => {
    try {
      await Promise.all(batch.ids.map((id) => db.remove("messages", id)));
      await loadSentMessages();
      toast.success("تم حذف الرسالة المُرسلة ✅");
    } catch {
      toast.error("مش قادر تحذف الرسالة دي");
    }
  };

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
    if (sendingRef.current) return;
    if (!title.trim() || !body.trim()) return;
    if (audience === "specific" && !specificEmail) {
      toast.error("اختر المستخدم المطلوب");
      return;
    }
    sendingRef.current = true;
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
        const roles = targets.flatMap((target) => ROLE_BY_TARGET[target] || []);
        const recipients = users.filter(
          (item) => roles.includes(item.role) && !item.disabled,
        );
        if (recipients.length === 0) {
          toast.error("مفيش مستخدمين بالدور المختار — ظبط أدوار الفريق الأول");
          return;
        }
        const payloadFingerprint = JSON.stringify({
          title,
          body,
          path,
          recipients: recipients.map((recipient) => recipient.email).sort(),
        });
        if (broadcastRef.current.fingerprint !== payloadFingerprint) {
          broadcastRef.current = {
            fingerprint: payloadFingerprint,
            id: crypto.randomUUID(),
          };
        }
        const { data: broadcastResult, error: broadcastError } = await supabase.rpc(
          "send_broadcast_messages",
          {
            p_broadcast_id: broadcastRef.current.id,
            p_from_email: user?.email || "",
            p_from_name: user?.full_name || "Admin",
            p_subject: title,
            p_body: body,
            p_path: path || null,
            p_recipients: recipients.map((recipient) => recipient.email),
          },
        );
        if (broadcastError) throw broadcastError;
        const result = Array.isArray(broadcastResult)
          ? broadcastResult[0]
          : broadcastResult;
        const sent = Number(result?.inserted) || 0;
        const duplicates = Number(result?.duplicates) || 0;
        const failed =
          Number(result?.requested ?? recipients.length) - sent - duplicates;
        if (failed > 0) {
          toast.error(
            `تم إرسال ${sent} من ${recipients.length} رسالة. فشل إرسال ${failed} رسالة، أعد المحاولة للمتبقي فقط.`,
          );
          return;
        }
        broadcastRef.current = { fingerprint: "", id: "" };
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
      toast.success("تم إرسال الإعلان لجميع المستخدمين ✓.");
    } catch (error) {
      toast.error(error?.message || "تعذر إرسال الرسائل. حاول مرة أخرى.");
    } finally {
      sendingRef.current = false;
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
        <CardTitle className="flex items-start gap-2 text-lg text-foreground">
          <Megaphone size={20} className="mt-0.5 shrink-0 text-primary" />
          <span>
            نشر الإعلان والرسائل
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              اختر النوع والمستهدفين، ثم اكتب المحتوى وراجع المعاينة قبل النشر.
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          {audience === "all" && (
            <FormSection
              icon={Megaphone}
              title="نوع الإعلان"
              hint="النوع بيحدد شكل وألوان الإعلان في واجهة المستخدم."
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries(NOTICE_TYPES).map(([key, config]) => {
                  const Icon = config.icon;
                  const selected = type === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setType(key)}
                      className="flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-all"
                      style={{
                        background: selected ? config.bg : "transparent",
                        borderColor: selected
                          ? config.border
                          : "hsl(var(--border))",
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
            </FormSection>
          )}

          <FormSection
            icon={Users}
            title="المستلمون"
            hint={`هيتم الإرسال إلى: ${audienceLabel}`}
          >
            <div className="flex flex-wrap gap-2">
              {TARGETS.map((target) => {
                const Icon = target.icon;
                const selected = targets.includes(target.id);
                return (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => toggleTarget(target.id)}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all"
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
                          className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: target.color }}
                        />
                      )}
                  </button>
                );
              })}
            </div>
            {audience === "specific" && (
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  المستخدم المستهدف
                </span>
                <Select value={specificEmail} onValueChange={setSpecificEmail}>
                  <SelectTrigger className="bg-input border-border h-9 w-full">
                    <SelectValue placeholder="اختر المستخدم..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border max-h-48">
                    {users
                      .filter((item) => !item.disabled)
                      .map((item) => (
                        <SelectItem key={item.id} value={item.email}>
                          {item.full_name
                            ? `${item.full_name} — ${item.email}`
                            : item.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </label>
            )}
          </FormSection>

          <FormSection
            icon={MapPin}
            title="المسار المستهدف (اختياري)"
            hint={
              audience === "all"
                ? "لو حددت مسار، الإعلان هيظهر لطلاب المسار ده فقط."
                : "المسار هيظهر كمعلومة إضافية داخل الرسالة."
            }
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  القسم
                </span>
                <Select value={pathSection} onValueChange={setPathSection}>
                  <SelectTrigger className="bg-input border-border h-9 w-full text-xs">
                    <SelectValue placeholder="كل الأقسام" />
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
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  السنة
                </span>
                <Select value={pathYear} onValueChange={setPathYear}>
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
            </div>
            {path && <MetaChip icon={MapPin}>{path}</MetaChip>}
          </FormSection>

          <FormSection
            icon={MessageSquare}
            title="محتوى الرسالة"
            hint={
              audience === "all"
                ? "العنوان والنص هيظهروا في إعلان عام لكل المستخدمين."
                : "اكتب رسالة واضحة ومختصرة للمستهدفين."
            }
          >
            <div className="space-y-2">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  عنوان الرسالة
                </span>
                <Input
                  placeholder="مثال: موعد تسليم مشروع التخرج"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  className="bg-input border-border"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">
                  نص الرسالة
                </span>
                <Textarea
                  placeholder={
                    audience === "all"
                      ? "اكتب نص الإعلان الذي سيصل لجميع المستخدمين..."
                      : "اكتب نص الرسالة..."
                  }
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  required
                  className="bg-input border-border min-h-[90px]"
                />
              </label>
            </div>
            {(title || body) && audience === "all" && (
              <div className="space-y-2 rounded-lg border border-border/60 bg-background/30 p-2.5">
                <p className="text-[11px] font-medium text-muted-foreground">
                  معاينة الإعلان
                </p>
                <AnnouncementPreview
                  preview={{ title, body, type, isPreview: true }}
                />
              </div>
            )}
          </FormSection>

          <Button
            type="submit"
            disabled={sending || !title.trim() || !body.trim()}
            className="flex h-10 w-full items-center gap-2 bg-primary text-primary-foreground hover:brightness-110"
          >
            <Send size={15} />
            {sending
              ? "جاري الإرسال..."
              : audience === "specific"
                ? "إرسال للمستخدم المحدد"
                : audience === "group"
                  ? `إرسال إلى ${audienceLabel}`
                  : "نشر للجميع"}
          </Button>
        </form>
        {announcements.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Megaphone size={14} />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  الإعلانات المنشورة
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {announcements.length} إعلان — تقدر توقفه أو تحذفه في أي وقت.
                </p>
              </div>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {announcements.map((announcement) => {
                const config =
                  NOTICE_TYPES[announcement.type] || NOTICE_TYPES.info;
                const Icon = config.icon;
                const active = Boolean(announcement.pinned);
                return (
                  <div
                    key={announcement.id}
                    className="flex items-start gap-3 rounded-xl border p-3"
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
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                          {announcement.title}
                        </p>
                        <span
                          className="shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{
                            background: active ? config.bg : "transparent",
                            borderColor: active
                              ? config.border
                              : "hsl(var(--border))",
                            color: active
                              ? config.color
                              : "hsl(var(--muted-foreground))",
                          }}
                        >
                          {active ? "ظاهر الآن" : "متوقف"}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {announcement.body}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {announcement.created_by && (
                          <MetaChip icon={Mail}>
                            {announcement.created_by}
                          </MetaChip>
                        )}
                        {announcement.created_date && (
                          <MetaChip icon={CalendarClock}>
                            {formatDate(
                              new Date(announcement.created_date),
                              "MMM d, HH:mm",
                            )}
                          </MetaChip>
                        )}
                        {announcement.path && (
                          <MetaChip icon={MapPin}>
                            {announcement.path}
                          </MetaChip>
                        )}
                      </div>
                    </div>
                    {(isSuperAdmin ||
                      announcement.created_by === user?.email) && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => toggleAnnouncement(announcement)}
                          className="rounded-md border px-2 py-1 text-[10px] font-semibold transition-all"
                          style={{
                            background: active ? config.bg : "transparent",
                            borderColor: active
                              ? config.border
                              : "hsl(var(--border))",
                            color: active
                              ? config.color
                              : "hsl(var(--muted-foreground))",
                          }}
                          title={active ? "إيقاف الإعلان" : "تفعيل الإعلان"}
                        >
                          {active ? "إيقاف" : "تفعيل"}
                        </button>
                        <button
                          onClick={() => deleteAnnouncement(announcement.id)}
                          aria-label="حذف الإعلان"
                          className="p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {sentBatches.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Send size={14} />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  الرسائل المرسلة
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  آخر {sentBatches.length} دفعة إرسال.
                </p>
              </div>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {sentBatches.map((batch) => (
                <div
                  key={batch.key}
                  className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/30 p-3"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Send size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {batch.subject || "(بدون عنوان)"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <MetaChip icon={Users}>
                        {batch.ids.length === 1
                          ? "مستلم واحد"
                          : `${batch.ids.length} مستلم`}
                      </MetaChip>
                      {isSuperAdmin && batch.from_email && (
                        <MetaChip icon={Mail}>{batch.from_email}</MetaChip>
                      )}
                      {batch.created_date && (
                        <MetaChip icon={CalendarClock}>
                          {formatDate(
                            new Date(batch.created_date),
                            "MMM d, HH:mm",
                          )}
                        </MetaChip>
                      )}
                      {batch.path && (
                        <MetaChip icon={MapPin}>{batch.path}</MetaChip>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteBatch(batch)}
                    aria-label="حذف الرسالة المرسلة"
                    className="shrink-0 p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
