import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  BookOpen,
  Eye,
  FileText,
  Link2,
  Pencil,
  Search,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/subjects/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useMaterialViewer } from "@/components/material/MaterialViewerProvider";
import {
  materialFromOfficial,
  materialFromResource,
} from "@/components/material/types";
import {
  MAJOR_LABELS,
  SEMESTER_LABELS,
  YEAR_LABELS,
} from "@/components/subjects/labels";
import { db } from "@/lib/api";
import { formatDate } from "@/lib/formatDate";
import { MATERIAL_RATING_EVENT } from "@/lib/materialRatings";
import { supabase } from "@/lib/supabase";

const TYPE_LABELS = {
  lecture_item: "محتوى محاضرة",
  section_item: "محتوى سكشن",
  resource: "مورد",
};

const TYPE_ICONS = {
  lecture_item: BookOpen,
  section_item: Users,
  resource: Link2,
};

const PAGE_SIZE = 50;

function StatCard({ label, value, icon: Icon, tone = "primary" }) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "success"
        ? "text-emerald-400"
        : "text-primary";
  return (
    <Card className="neon-card bg-card">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-lg bg-muted/50 p-2 ${toneClass}`}>
          <Icon size={18} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function isLowRated(row) {
  return Number(row.total_votes) > 0 && Number(row.score) <= 0;
}

function trackLabel(row) {
  const major = MAJOR_LABELS[row.major] || "بدون تخصص";
  const year = YEAR_LABELS[row.year] || "بدون سنة";
  const semester = SEMESTER_LABELS[row.semester] || "بدون ترم";
  return `${major} · ${year} · ${semester}`;
}

export default function DashboardRatings() {
  const navigate = useNavigate();
  const { openMaterial } = useMaterialViewer();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [major, setMajor] = useState("all");
  const [year, setYear] = useState("all");
  const [semester, setSemester] = useState("all");
  const [type, setType] = useState("all");
  const [lowOnly, setLowOnly] = useState(false);
  const [sort, setSort] = useState("popular");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [votersRow, setVotersRow] = useState(null);
  const [voters, setVoters] = useState([]);
  const [votersLoading, setVotersLoading] = useState(false);

  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: rpcError } = await supabase.rpc(
      "get_material_rating_overview",
    );
    if (rpcError) {
      setError(rpcError.message || "تعذّر تحميل التقييمات");
      setLoading(false);
      return;
    }
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = (event) => {
      const detail = event.detail;
      if (!detail?.summary) return;
      setRows((previous) =>
        previous.map((row) => {
          if (
            row.material_type !== detail.materialType ||
            row.material_id !== detail.materialId
          ) {
            return row;
          }
          const likes = Number(detail.summary.likes) || 0;
          const dislikes = Number(detail.summary.dislikes) || 0;
          return {
            ...row,
            likes,
            dislikes,
            total_votes: likes + dislikes,
            score: likes - dislikes,
            last_vote_at: new Date().toISOString(),
          };
        }),
      );
    };

    window.addEventListener(MATERIAL_RATING_EVENT, handler);
    return () => window.removeEventListener(MATERIAL_RATING_EVENT, handler);
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, major, year, semester, type, lowOnly, sort]);

  const stats = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const likes = Number(row.likes) || 0;
        const dislikes = Number(row.dislikes) || 0;
        const total = Number(row.total_votes) || 0;
        acc.materials += 1;
        acc.likes += likes;
        acc.dislikes += dislikes;
        acc.votes += total;
        if (total > 0) acc.ratedMaterials += 1;
        if (isLowRated(row)) acc.lowRated += 1;
        return acc;
      },
      {
        materials: 0,
        ratedMaterials: 0,
        likes: 0,
        dislikes: 0,
        votes: 0,
        lowRated: 0,
      },
    );
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = rows.filter((row) => {
      if (major !== "all" && row.major !== major) return false;
      if (year !== "all" && row.year !== year) return false;
      if (semester !== "all" && row.semester !== semester) return false;
      if (type !== "all" && row.material_type !== type) return false;
      if (lowOnly && !isLowRated(row)) return false;
      if (
        term &&
        !`${row.title || ""} ${row.subject_name || ""}`
          .toLowerCase()
          .includes(term)
      ) {
        return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sort === "popular") {
        return (
          Number(b.total_votes) - Number(a.total_votes) ||
          Number(a.score) - Number(b.score)
        );
      }
      if (sort === "newest") {
        const aTime = a.last_vote_at ? new Date(a.last_vote_at).getTime() : 0;
        const bTime = b.last_vote_at ? new Date(b.last_vote_at).getTime() : 0;
        return bTime - aTime;
      }
      return (
        Number(a.score) - Number(b.score) ||
        Number(b.total_votes) - Number(a.total_votes)
      );
    });

    return list;
  }, [rows, search, major, year, semester, type, lowOnly, sort]);

  const visible = filtered.slice(0, visibleCount);

  const openVoters = async (row) => {
    setVotersRow(row);
    setVoters([]);
    setVotersLoading(true);
    const { data, error: rpcError } = await supabase.rpc(
      "get_material_rating_voters",
      {
        p_material_type: row.material_type,
        p_material_id: row.material_id,
      },
    );
    if (rpcError) {
      toast.error(rpcError.message || "تعذّر تحميل المصوّتين");
      setVotersLoading(false);
      return;
    }
    setVoters(data || []);
    setVotersLoading(false);
  };

  const openRowMaterial = async (row) => {
    try {
      if (row.material_type === "resource") {
        const resource = await db.get("resources", row.material_id);
        if (resource) openMaterial(materialFromResource(resource));
        return;
      }
      const table =
        row.material_type === "section_item"
          ? "section_items"
          : "lecture_items";
      const item = await db.get(table, row.material_id);
      if (item) {
        openMaterial(
          materialFromOfficial(
            item,
            row.material_type === "section_item" ? "section" : "lecture",
          ),
        );
      }
    } catch {
      toast.error("تعذّر فتح المادة");
    }
  };

  const editRow = (row) => {
    if (row.material_type === "resource" || !row.subject_id) {
      navigate("/dashboard/resources");
      return;
    }
    navigate(`/dashboard/subjects/${row.subject_id}`);
  };

  const confirmDelete = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try {
      const table =
        deleting.material_type === "resource"
          ? "resources"
          : deleting.material_type === "section_item"
            ? "section_items"
            : "lecture_items";
      await db.remove(table, deleting.material_id);
      toast.success("تم حذف المادة وتقييماتها");
      setDeleting(null);
      await load();
    } catch (deleteError) {
      toast.error(deleteError?.message || "تعذّر حذف المادة");
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div dir="rtl">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
            <Star size={26} className="text-primary" />
            تقييمات المواد
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            آراء الطلاب في المواد الرسمية، مرتبة افتراضيًا حسب الأكثر تفاعلًا.
            استخدم الفلاتر لعرض التقييمات المنخفضة، واضغط على عدد الأصوات لعرض
            المصوّتين.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          تحديث
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="المواد" value={stats.materials} icon={FileText} />
        <StatCard
          label="مواد عليها تقييم"
          value={stats.ratedMaterials}
          icon={Star}
        />
        <StatCard
          label="إعجاب"
          value={stats.likes}
          icon={ThumbsUp}
          tone="success"
        />
        <StatCard
          label="عدم إعجاب"
          value={stats.dislikes}
          icon={ThumbsDown}
          tone="danger"
        />
        <StatCard
          label="تقييمات منخفضة"
          value={stats.lowRated}
          icon={AlertTriangle}
          tone="danger"
        />
      </div>

      <Card className="neon-card mb-6 bg-card">
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative sm:col-span-2">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="ابحث باسم المادة أو المادة الدراسية..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="border-border bg-input pl-10"
            />
          </div>

          <Select value={major} onValueChange={setMajor}>
            <SelectTrigger className="border-border bg-input">
              <SelectValue placeholder="التخصص" />
            </SelectTrigger>
            <SelectContent className="border-border bg-card">
              <SelectItem value="all">كل التخصصات</SelectItem>
              <SelectItem value="ai">AI</SelectItem>
              <SelectItem value="cybersecurity">Cybersecurity</SelectItem>
            </SelectContent>
          </Select>

          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="border-border bg-input">
              <SelectValue placeholder="السنة" />
            </SelectTrigger>
            <SelectContent className="border-border bg-card">
              <SelectItem value="all">كل السنوات</SelectItem>
              <SelectItem value="year-1">Year 1</SelectItem>
              <SelectItem value="year-2">Year 2</SelectItem>
              <SelectItem value="year-3">Year 3</SelectItem>
              <SelectItem value="year-4">Year 4</SelectItem>
            </SelectContent>
          </Select>

          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger className="border-border bg-input">
              <SelectValue placeholder="الترم" />
            </SelectTrigger>
            <SelectContent className="border-border bg-card">
              <SelectItem value="all">كل الترمات</SelectItem>
              <SelectItem value="sem-1">Semester 1</SelectItem>
              <SelectItem value="sem-2">Semester 2</SelectItem>
            </SelectContent>
          </Select>

          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="border-border bg-input">
              <SelectValue placeholder="النوع" />
            </SelectTrigger>
            <SelectContent className="border-border bg-card">
              <SelectItem value="all">كل الأنواع</SelectItem>
              <SelectItem value="lecture_item">محتوى محاضرة</SelectItem>
              <SelectItem value="section_item">محتوى سكشن</SelectItem>
              <SelectItem value="resource">مورد</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="border-border bg-input">
              <SelectValue placeholder="الترتيب" />
            </SelectTrigger>
            <SelectContent className="border-border bg-card">
              <SelectItem value="low">الأقل تقييمًا</SelectItem>
              <SelectItem value="popular">الأكثر تفاعلًا</SelectItem>
              <SelectItem value="newest">الأحدث تصويتًا</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant={lowOnly ? "default" : "outline"}
            onClick={() => setLowOnly((value) => !value)}
            className={lowOnly ? "bg-destructive text-destructive-foreground" : ""}
          >
            <AlertTriangle size={15} className="ml-1" />
            تقييمات منخفضة
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} className="h-24 rounded-lg bg-muted" />
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
      ) : filtered.length === 0 ? (
        <Card className="neon-card bg-card">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            مفيش مواد مطابقة للفلاتر الحالية.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {visible.map((row) => {
              const Icon = TYPE_ICONS[row.material_type] || FileText;
              return (
                <Card
                  key={`${row.material_type}:${row.material_id}`}
                  className="neon-card bg-card"
                >
                  <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-semibold text-foreground">
                            {row.title || "بدون عنوان"}
                          </h3>
                          <Badge variant="outline" className="text-[11px]">
                            {TYPE_LABELS[row.material_type] || row.material_type}
                          </Badge>
                          {isLowRated(row) && (
                            <Badge className="border border-destructive/30 bg-destructive/15 text-[11px] text-destructive">
                              تقييم منخفض
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {row.subject_name || "غير مرتبط بمادة دراسية"} ·{" "}
                          {trackLabel(row)}
                        </p>
                        {row.last_vote_at && (
                          <p className="mt-1 text-[11px] text-muted-foreground/70">
                            آخر تصويت: {formatDate(row.last_vote_at)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openVoters(row)}
                        className="flex items-center gap-1 rounded-lg bg-muted/40 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
                        title="عرض المصوّتين"
                      >
                        <ThumbsUp size={13} className="text-emerald-400" />
                        {row.likes}
                      </button>
                      <button
                        type="button"
                        onClick={() => openVoters(row)}
                        className="flex items-center gap-1 rounded-lg bg-muted/40 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
                        title="عرض المصوّتين"
                      >
                        <ThumbsDown size={13} className="text-destructive" />
                        {row.dislikes}
                      </button>
                      <Badge
                        variant="outline"
                        className={
                          Number(row.score) < 0
                            ? "border-destructive/30 text-destructive"
                            : "text-muted-foreground"
                        }
                      >
                        الصافي {row.score}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {row.total_votes} صوت
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openRowMaterial(row)}
                        title="عرض المادة"
                        aria-label="عرض المادة"
                      >
                        <Eye size={16} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => editRow(row)}
                        title="إدارة المادة"
                        aria-label="إدارة المادة"
                      >
                        <Pencil size={16} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleting(row)}
                        title="حذف المادة"
                        aria-label="حذف المادة"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {visible.length < filtered.length && (
            <div className="mt-5 flex justify-center">
              <Button
                variant="outline"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              >
                عرض المزيد ({filtered.length - visible.length})
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog
        open={!!votersRow}
        onOpenChange={(open) => {
          if (!open) {
            setVotersRow(null);
            setVoters([]);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              أصوات: {votersRow?.title || "المادة"}
            </DialogTitle>
          </DialogHeader>
          {votersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-12 rounded-lg bg-muted" />
              ))}
            </div>
          ) : voters.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              مفيش أصوات على المادة دي لحد الآن.
            </p>
          ) : (
            <div className="space-y-2">
              {voters.map((voter) => (
                <div
                  key={`${voter.user_id}-${voter.value}`}
                  className="flex items-center gap-3 rounded-lg bg-muted/30 p-3"
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/20 text-sm font-semibold text-primary">
                    {voter.full_name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {voter.full_name || "بدون اسم"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {voter.email}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      Number(voter.value) === 1
                        ? "border-emerald-400/30 text-emerald-400"
                        : "border-destructive/30 text-destructive"
                    }
                  >
                    {Number(voter.value) === 1 ? "إعجاب" : "عدم إعجاب"}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(voter.updated_date)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="حذف المادة"
        description={`هل أنت متأكد من حذف "${deleting?.title || ""}"؟ سيتم حذف كل تقييماتها أيضًا.`}
        onConfirm={confirmDelete}
        busy={deleteBusy}
        confirmClassName="bg-destructive text-destructive-foreground"
      />
    </div>
  );
}
