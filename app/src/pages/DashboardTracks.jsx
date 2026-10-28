import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  GraduationCap,
  Pencil,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MAJOR_LABELS,
  SEMESTER_LABELS,
  YEAR_LABELS,
} from "@/components/subjects/labels";
import {
  MemberAvatar,
  RoleBadge,
  sortUsersByRole,
} from "@/components/team/roles";
import { db } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const MAJOR_ORDER = { ai: 0, cybersecurity: 1 };
const YEAR_ORDER = { "year-1": 0, "year-2": 1, "year-3": 2, "year-4": 3 };

function ownKeyFor(profile) {
  return `${profile?.major || "none"}:${profile?.year || "none"}`;
}

function trackLabel(profile) {
  const major = MAJOR_LABELS[profile?.major] || "بدون تخصص";
  const year = YEAR_LABELS[profile?.year] || "بدون سنة";
  const semester = SEMESTER_LABELS[profile?.semester] || "بدون ترم";
  return `${major} · ${year} · ${semester}`;
}

function groupTitle(group) {
  if (!group.major && !group.year) return "بدون مسار";
  return `${MAJOR_LABELS[group.major] || "بدون تخصص"} — ${
    YEAR_LABELS[group.year] || "بدون سنة"
  }`;
}

function TrackDialog({ member, form, saving, onChange, onSave, onClose }) {
  return (
    <Dialog open={!!member} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            تعديل مسار {member?.full_name || member?.email}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              التخصص
            </label>
            <Select
              value={form.major}
              onValueChange={(value) => onChange("major", value)}
            >
              <SelectTrigger className="border-border bg-input">
                <SelectValue placeholder="التخصص" />
              </SelectTrigger>
              <SelectContent className="border-border bg-card">
                <SelectItem value="none">غير محدد</SelectItem>
                <SelectItem value="ai">AI</SelectItem>
                <SelectItem value="cybersecurity">Cybersecurity</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              السنة الدراسية
            </label>
            <Select
              value={form.year}
              onValueChange={(value) => onChange("year", value)}
            >
              <SelectTrigger className="border-border bg-input">
                <SelectValue placeholder="السنة" />
              </SelectTrigger>
              <SelectContent className="border-border bg-card">
                <SelectItem value="none">غير محدد</SelectItem>
                <SelectItem value="year-1">Year 1</SelectItem>
                <SelectItem value="year-2">Year 2</SelectItem>
                <SelectItem value="year-3">Year 3</SelectItem>
                <SelectItem value="year-4">Year 4</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              الترم
            </label>
            <Select
              value={form.semester}
              onValueChange={(value) => onChange("semester", value)}
            >
              <SelectTrigger className="border-border bg-input">
                <SelectValue placeholder="الترم" />
              </SelectTrigger>
              <SelectContent className="border-border bg-card">
                <SelectItem value="none">غير محدد</SelectItem>
                <SelectItem value="sem-1">Semester 1</SelectItem>
                <SelectItem value="sem-2">Semester 2</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:brightness-110"
              disabled={saving}
              onClick={onSave}
            >
              حفظ
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardTracks() {
  const { profile, isSuperAdmin, refreshProfile } = useAuth();
  const [members, setMembers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    major: "none",
    year: "none",
    semester: "none",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [staffRows, subjectRows] = await Promise.all([
        db.filter("profiles", { role: ["admin", "super_admin"] }),
        db.list("subjects"),
      ]);
      setMembers((staffRows || []).filter((member) => !member.disabled));
      setSubjects(subjectRows || []);
    } catch (loadError) {
      setError(loadError?.message || "تعذّر تحميل مسارات الفريق");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const member of members) {
      const key = `${member.major || "none"}:${member.year || "none"}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          major: member.major || "",
          year: member.year || "",
          members: [],
        });
      }
      map.get(key).members.push(member);
    }

    const ownKey = ownKeyFor(profile);
    return [...map.values()]
      .map((group) => ({
        ...group,
        members: sortUsersByRole(group.members),
      }))
      .sort((a, b) => {
        if (a.key === ownKey) return -1;
        if (b.key === ownKey) return 1;
        if (!a.major || !a.year) return 1;
        if (!b.major || !b.year) return -1;
        const majorDiff =
          (MAJOR_ORDER[a.major] ?? 9) - (MAJOR_ORDER[b.major] ?? 9);
        if (majorDiff) return majorDiff;
        return (YEAR_ORDER[a.year] ?? 9) - (YEAR_ORDER[b.year] ?? 9);
      });
  }, [members, profile]);

  const ownGroup = groups.find((group) => group.key === ownKeyFor(profile));
  const ownTrackComplete = Boolean(profile?.major && profile?.year);

  const stats = useMemo(
    () => ({
      staff: members.length,
      groups: groups.length,
      unassigned: members.filter((member) => !member.major || !member.year)
        .length,
    }),
    [members, groups],
  );

  const openEdit = (member) => {
    setEditing(member);
    setForm({
      major: member.major || "none",
      year: member.year || "none",
      semester: member.semester || "none",
    });
  };

  const handleSave = async () => {
    if (!editing || saving) return;
    setSaving(true);
    try {
      await db.update("profiles", editing.id, {
        major: form.major === "none" ? null : form.major,
        year: form.year === "none" ? null : form.year,
        semester: form.semester === "none" ? null : form.semester,
      });
      if (editing.id === profile?.id) {
        await refreshProfile();
      }
      toast.success("تم تحديث المسار");
      setEditing(null);
      await load();
    } catch (saveError) {
      toast.error(saveError?.message || "تعذّر تحديث المسار");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div dir="rtl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
          <GraduationCap size={28} className="text-primary" />
          مسارات الفريق
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          الأدمنز في نفس التخصص والسنة في مجموعة واحدة. الترم ظاهر لكل عضو،
          والمجموعة بتجمع التخصص والسنة فقط.
        </p>
      </div>

      <Card className="neon-card mb-6 bg-card">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="rounded-lg bg-primary/10 p-3 text-primary">
            <GraduationCap size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">مسارك</p>
            <p className="text-lg font-semibold text-foreground">
              {trackLabel(profile)}
            </p>
            {ownTrackComplete ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {ownGroup
                  ? `${ownGroup.members.length} أدمن في نفس التخصص والسنة.`
                  : "مفيش أدمنز تانيين في نفس التخصص والسنة لحد الآن."}
              </p>
            ) : (
              <p className="mt-1 flex items-center gap-1 text-sm text-amber-400">
                <AlertTriangle size={14} />
                مسارك مش مكتمل. حدّده من الملف الشخصي عشان تظهر في مجموعتك.
              </p>
            )}
          </div>
          <Button asChild variant="outline">
            <Link to="/profile">
              تعديل مساري
              <ArrowLeft size={15} className="mr-2" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="neon-card bg-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">أعضاء الفريق</p>
            <p className="text-2xl font-bold text-foreground">{stats.staff}</p>
          </CardContent>
        </Card>
        <Card className="neon-card bg-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">المجموعات</p>
            <p className="text-2xl font-bold text-foreground">{stats.groups}</p>
          </CardContent>
        </Card>
        <Card className="neon-card bg-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">بدون مسار</p>
            <p className="text-2xl font-bold text-amber-400">
              {stats.unassigned}
            </p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-44 rounded-lg bg-muted" />
          ))}
        </div>
      ) : error ? (
        <Card className="neon-card bg-card">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertTriangle size={28} className="text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={load}>
              حاول تاني
            </Button>
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <Card className="neon-card bg-card">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            مفيش أدمنز مسجلين لحد الآن.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => {
            const isOwnGroup = group.key === ownKeyFor(profile);
            const subjectCount = subjects.filter(
              (subject) =>
                subject.major === group.major && subject.year === group.year,
            ).length;
            const termCounts = group.members.reduce((acc, member) => {
              const label =
                SEMESTER_LABELS[member.semester] || "بدون ترم";
              acc[label] = (acc[label] || 0) + 1;
              return acc;
            }, {});

            return (
              <Card
                key={group.key}
                className={`neon-card bg-card ${
                  isOwnGroup ? "border-primary/40" : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-lg text-foreground">
                      <Users size={19} className="text-primary" />
                      {groupTitle(group)}
                      {isOwnGroup && (
                        <Badge className="border border-primary/30 bg-primary/15 text-[11px] text-primary">
                          مجموعتك
                        </Badge>
                      )}
                      {(!group.major || !group.year) && (
                        <Badge className="border border-amber-400/30 bg-amber-400/10 text-[11px] text-amber-400">
                          مسار غير مكتمل
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users size={13} />
                        {group.members.length} أدمن
                      </span>
                      {group.major && group.year && (
                        <span className="flex items-center gap-1">
                          <BookOpen size={13} />
                          {subjectCount} مادة
                        </span>
                      )}
                      {Object.entries(termCounts).map(([label, count]) => (
                        <Badge
                          key={label}
                          variant="outline"
                          className="text-[11px]"
                        >
                          {label}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {group.members.map((member) => {
                    const isSelf = member.id === profile?.id;
                    return (
                      <div
                        key={member.id}
                        className="flex flex-col gap-2 rounded-lg bg-muted/30 p-3 sm:flex-row sm:items-center"
                      >
                        <MemberAvatar name={member.full_name} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium text-foreground">
                              {member.full_name || "بدون اسم"}
                            </p>
                            {isSelf && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-primary"
                              >
                                أنت
                              </Badge>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-[11px] text-muted-foreground"
                          >
                            {SEMESTER_LABELS[member.semester] || "بدون ترم"}
                          </Badge>
                          <RoleBadge user={member} />
                          {isSuperAdmin || isSelf ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(member)}
                              title={`تعديل مسار ${member.full_name || member.email}`}
                              aria-label={`تعديل مسار ${member.full_name || member.email}`}
                            >
                              <Pencil size={15} />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TrackDialog
        member={editing}
        form={form}
        saving={saving}
        onChange={(field, value) =>
          setForm((prev) => ({ ...prev, [field]: value }))
        }
        onSave={handleSave}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
