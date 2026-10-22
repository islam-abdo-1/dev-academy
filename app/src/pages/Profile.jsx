import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  BrainCircuit,
  Camera,
  CircleDashed,
  House,
  Save,
  ShieldCheck,
  User,
  Save as SaveIcon,
  Share2,
  Users,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  Trash2,
  ExternalLink,
  Files,
  Globe,
  Lock,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ConnectionError from "@/components/ConnectionError";
import UserAvatar from "@/components/UserAvatar";
import { SavedListsSidebar } from "@/components/user/SavedListsSidebar";
import { SavedListView } from "@/components/user/SavedListView";
import { PersonalUploadZone } from "@/components/user/PersonalUploadZone";
import { PublishRequestDialog } from "@/components/user/PublishRequestDialog";
import { ShareListDialog } from "@/components/share/ShareListDialog";
import { MaterialTypeIcon } from "@/components/material/MaterialTypeIcon";
import { materialFromPersonalFile } from "@/components/material/types";
import { useMaterialViewer } from "@/components/material/MaterialViewerProvider";
import { useSavedLists } from "@/hooks/useSavedLists";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useShares } from "@/hooks/useShares";
import { usePersonalFiles } from "@/hooks/usePersonalFiles";
import { usePublishRequests } from "@/hooks/usePublishRequests";
import { compressAvatar } from "@/lib/images/compress";
import { safeHttpUrl } from "@/lib/materialPreview";
import { cn, formatDate } from "@/lib/utils";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { formatBytes } from "@/lib/utils";

const majorBadgeMap = {
  ai: {
    Icon: BrainCircuit,
    label: "Artificial Intelligence",
    color: "hsl(190, 100%, 50%)",
    border: "hsla(190, 100%, 50%, 0.35)",
    background: "hsla(190, 100%, 50%, 0.08)",
  },
  cybersecurity: {
    Icon: ShieldCheck,
    label: "Cybersecurity",
    color: "hsl(160, 60%, 50%)",
    border: "hsla(160, 60%, 50%, 0.35)",
    background: "hsla(160, 60%, 50%, 0.08)",
  },
};

function Starfield() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    let width;
    let height;
    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const stars = Array.from({ length: 120 }, (_, index) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.5 + 0.3,
      opacity: Math.random() * 0.6 + 0.15,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinkleOffset: Math.random() * Math.PI * 2,
      color:
        index % 6 === 0
          ? "rgba(0,230,255,"
          : index % 9 === 0
            ? "rgba(80,230,160,"
            : "rgba(200,220,255,",
    }));
    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      frame += 0.016;
      stars.forEach((star) => {
        const alpha =
          star.opacity *
          (0.5 +
            0.5 *
              Math.sin(frame * star.twinkleSpeed * 60 + star.twinkleOffset));
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = star.color + alpha + ")";
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.8 }}
    />
  );
}

function PageBackground() {
  return (
    <>
      <style>
        {
          "@keyframes glow-pulse{0%,to{opacity:.05}50%{opacity:.08}}.animate-glow-pulse{animation:glow-pulse 4s ease-in-out infinite}"
        }
      </style>
      <Starfield />
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full animate-glow-pulse"
          style={{
            background:
              "radial-gradient(circle, hsla(190,100%,50%,0.08) 0%, transparent 70%)",
            filter: "blur(60px)",
            willChange: "opacity",
          }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-[400px] h-[400px] rounded-full animate-glow-pulse"
          style={{
            background:
              "radial-gradient(circle, hsla(160,60%,50%,0.07) 0%, transparent 70%)",
            filter: "blur(70px)",
            animationDelay: "2s",
            willChange: "opacity",
          }}
        />
      </div>
    </>
  );
}

function Footer() {
  return (
    <footer className="text-center py-6 border-t border-border/30">
      <p className="flex items-center justify-center gap-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          Created by
        </span>
        <span
          style={{
            fontSize: "1.15rem",
            background:
              "linear-gradient(135deg, hsl(190,100%,50%), hsl(160,60%,50%))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          𝘌𝘕𝘎. 𝐼𝑠𝑙𝑎𝑚 𝐴𝑏𝑑𝑜
        </span>
      </p>
    </footer>
  );
}

function storagePathFromUrl(url) {
  if (!url) return null;
  const marker = "/storage/v1/object/public/media/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length).split("?")[0]);
}

export default function Profile() {
  const { profile, user, loading, profileError, refreshProfile } = useAuth();
  const { openMaterial, openShare } = useMaterialViewer();
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = ["profile", "saved", "files", "shares"];
  const requestedTab = searchParams.get("tab");
  const activeTab = validTabs.includes(requestedTab) ? requestedTab : "profile";
  const setActiveTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };
  const [form, setForm] = useState({
    full_name: "",
    major: "",
    year: "",
    semester: "",
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [usageRefreshKey, setUsageRefreshKey] = useState(0);
  const [selectedListId, setSelectedListId] = useState(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareListId, setShareListId] = useState(null);
  const [publishOpen, setPublishOpen] = useState(false);

  const { lists, loading: listsLoading, createList, refresh: refreshLists } = useSavedLists();
  const { shares, loading: sharesLoading, revokeShare, refresh: refreshShares } = useShares();
  const {
    files: personalFiles,
    loading: personalLoading,
    uploading: personalUploading,
    uploadProgress,
    deleteFile,
    togglePublic,
    refresh: refreshPersonalFiles,
  } = usePersonalFiles();
  const {
    requests: publishRequests,
    loading: requestsLoading,
    cancelRequest,
    refresh: refreshRequests,
  } = usePublishRequests();

  const handleShareFile = (file) => {
    openShare(materialFromPersonalFile(file));
  };

  const handleDeleteFile = async (fileId) => {
    if (!confirm("حذف هذا الملف نهائيًا؟")) return;
    const ok = await deleteFile(fileId);
    if (ok) {
      setUsageRefreshKey((key) => key + 1);
      toast.success("تم حذف الملف");
    } else {
      toast.error("تعذر حذف الملف");
    }
  };

  const handleTogglePublic = async (fileId) => {
    const ok = await togglePublic(fileId);
    if (ok) toast.success("تم تحديث حالة الملف");
    else toast.error("تعذر تحديث الملف");
  };

  const handleCancelRequest = async (requestId) => {
    if (!confirm("إلغاء طلب النشر؟")) return;
    const ok = await cancelRequest(requestId);
    if (ok) toast.success("تم إلغاء الطلب");
    else toast.error("تعذر إلغاء الطلب");
  };

  const statusLabel = {
    pending: "قيد المراجعة",
    approved: "تمت الموافقة",
    rejected: "مرفوض",
    needs_changes: "يحتاج تعديلات",
  };

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name || "",
      major: profile.major || "",
      year: profile.year || "",
      semester: profile.semester || "",
    });
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await db.update("profiles", user.id, {
        full_name: form.full_name,
        major: form.major,
        year: form.year,
        semester: form.semester,
      });
      await refreshProfile();
      toast.success("تم تحديث الملف الشخصي بنجاح!");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast.error("صيغة الصورة غير مدعومة — استخدم PNG أو JPG أو WEBP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة كبير جداً — الحد الأقصى 5 ميجابايت");
      return;
    }
    setUploading(true);
    const previousPath = storagePathFromUrl(profile?.avatar_url);
    try {
      const compressed = await compressAvatar(file);
      const path = `avatars/${user.id}.${compressed.extension}`;
      const { error } = await supabase.storage
        .from("media")
        .upload(path, compressed.file, { upsert: true, cacheControl: "300" });
      if (error) throw error;
      const { data } = supabase.storage.from("media").getPublicUrl(path);
      const versionedUrl = `${data.publicUrl}?v=${Date.now()}`;
      await db.update("profiles", user.id, { avatar_url: versionedUrl });
      if (previousPath && previousPath !== path) {
        await supabase.storage.from("media").remove([previousPath]);
      }
      await refreshProfile();
      toast.success("تم تحديث الصورة الشخصية بنجاح!");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
};

const getMajorBadge = function(major) {
    if (major === "ai") {
      return {
        Icon: BrainCircuit,
        label: "Artificial Intelligence",
        color: "hsl(190, 100%, 50%)",
        border: "hsla(190, 100%, 50%, 0.35)",
        background: "hsla(190, 100%, 50%, 0.08)",
      };
    }
    if (major === "cybersecurity") {
      return {
        Icon: ShieldCheck,
        label: "Cybersecurity",
        color: "hsl(160, 60%, 50%)",
        border: "hsla(160, 60%, 50%, 0.35)",
        background: "hsla(160, 60%, 50%, 0.08)",
      };
    }
    return {
      Icon: CircleDashed,
      label: "Major not set",
      color: "hsl(215, 20%, 55%)",
      border: "hsla(215, 20%, 55%, 0.35)",
      background: "hsla(215, 20%, 55%, 0.08)",
    };
  };

const majorBadge = getMajorBadge(form.major);

const handleListSelect = function(listId) {
    setSelectedListId(listId);
  };

  const handleShareList = function(listId) {
    setShareListId(listId);
    setShowShareDialog(true);
  };

  function getItemTitle(item) {
    if (item.content_type === "official" && item.official_material) {
      return item.official_material.title;
    }
    if (item.content_type === "personal" && item.personal_file) {
      return item.personal_file.title;
    }
    return item.external_url || 'External Link';
  }

  function getItemUrl(item) {
    if (item.content_type === "official" && item.official_material) {
      return item.official_material.url;
    }
    if (item.content_type === "personal" && item.personal_file) {
      return item.personal_file.file_url;
    }
    return item.external_url || '#';
  }

  function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return (
    <div className="min-h-screen bg-background relative">
      <style>
        {
          ".neon-card{border:1px solid hsl(190,50%,15%);box-shadow:0 0 12px #00d4ff26}.neon-card:hover{box-shadow:0 0 20px #00d4ff4d;transform:translateY(-4px)}"
        }
      </style>
      <PageBackground />
      <nav
        className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 h-16 flex items-center px-6 gap-4"
        style={{
          backdropFilter: "blur(12px)",
          background: "hsla(240, 50%, 3%, 0.8)",
        }}
      >
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/logo-mark.webp"
            alt="Logo"
            style={{
              width: 32,
              height: 32,
              objectFit: "contain",
              borderRadius: 8,
              border: "1px solid hsla(190,100%,50%,0.3)",
            }}
          />
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              color: "hsl(190,100%,50%)",
              fontWeight: 600,
            }}
          >
            Dev Academy
          </span>
        </Link>
        <div className="flex items-center gap-2 text-sm text-muted-foreground ml-4 font-mono">
          <Link
            to="/"
            className="hover:text-primary transition-colors flex items-center gap-1"
          >
            <House size={13} />
            {" Home"}
          </Link>
          <span>›</span>
          <span className="text-foreground">Profile</span>
        </div>
      </nav>
      <main className="pt-24 pb-16 px-4 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        </div>
        {profileError && !profile ? (
          <ConnectionError message={profileError} onRetry={refreshProfile} />
        ) : loading || !profile ? (
          <div className="space-y-4">
            {[1, 2, 3].map((key) => (
              <div
                key={key}
                className="h-16 bg-muted rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1.5 sm:grid-cols-4">
                <TabsTrigger className="min-h-10 gap-2 px-2 py-2 text-xs sm:text-sm" value="profile">
                  <User size={14} />
                  الملف الشخصي
                </TabsTrigger>
                <TabsTrigger className="min-h-10 gap-2 px-2 py-2 text-xs sm:text-sm" value="saved">
                  <SaveIcon size={14} />
                  المحفوظات
                </TabsTrigger>
                <TabsTrigger className="min-h-10 gap-2 px-2 py-2 text-xs sm:text-sm" value="files">
                  <Files size={14} />
                  ملفاتي
                </TabsTrigger>
                <TabsTrigger className="min-h-10 gap-2 px-2 py-2 text-xs sm:text-sm" value="shares">
                  <Share2 size={14} />
                  المشاركات
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-5 mt-4">
                <Card className="neon-card bg-card">
                  <CardContent className="pt-6 flex flex-col items-center gap-4">
                    <div className="relative">
                      <UserAvatar
                        src={profile.avatar_url}
                        alt="Avatar"
                        className="w-24 h-24 rounded-full object-cover"
                        style={{
                          border: "2px solid hsl(190,100%,50%)",
                          boxShadow: "0 0 16px hsla(190,100%,50%,0.3)",
                        }}
                      />
                      <label
                        className="absolute bottom-0 right-0 cursor-pointer w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ background: "hsl(190,100%,50%)" }}
                      >
                        {uploading ? (
                          <div className="w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Camera size={14} className="text-background" />
                        )}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={handleAvatarUpload}
                          disabled={uploading}
                        />
                      </label>
                    </div>
                    <div className="text-center">
                      <p className="text-foreground font-semibold">
                        {profile.full_name || "No name"}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {profile.email}
                      </p>
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-mono mt-1 px-2.5 py-1 rounded-full border"
                        style={{
                          color: majorBadge.color,
                          borderColor: majorBadge.border,
                          background: majorBadge.background,
                        }}
                      >
                        <majorBadge.Icon size={13} />
                        {majorBadge.label}
                      </span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="neon-card bg-card">
                  <CardHeader>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <User size={18} className="text-primary" />
                      {" Edit Profile"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">
                        Display Name
                      </label>
                      <Input
                        value={form.full_name}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            full_name: e.target.value,
                          }))
                        }
                        className="bg-input border-border"
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">
                        Email (read-only)
                      </label>
                      <Input
                        value={profile.email || ""}
                        readOnly
                        className="bg-input border-border opacity-60 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">
                        التخصص
                      </label>
                      <select
                        value={form.major}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, major: e.target.value }))
                        }
                        className="w-full h-9 rounded-md border border-input px-3 text-sm text-foreground"
                        style={{ background: "hsl(240,20%,15%)" }}
                      >
                        <option value="">غير محدد</option>
                        <option value="ai">الذكاء الاصطناعي (AI)</option>
                        <option value="cybersecurity">
                          الأمن السيبراني (Cybersecurity)
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">
                        السنة الدراسية
                      </label>
                      <select
                        value={form.year}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, year: e.target.value }))
                        }
                        className="w-full h-9 rounded-md border border-input px-3 text-sm text-foreground"
                        style={{ background: "hsl(240,20%,15%)" }}
                      >
                        <option value="">غير محدد</option>
                        <option value="year-1">السنة الأولى</option>
                        <option value="year-2">السنة الثانية</option>
                        <option value="year-3">السنة الثالثة</option>
                        <option value="year-4">السنة الرابعة</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground mb-1 block">
                        الترم الحالي
                      </label>
                      <select
                        value={form.semester}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, semester: e.target.value }))
                        }
                        className="w-full h-9 rounded-md border border-input px-3 text-sm text-foreground"
                        style={{ background: "hsl(240,20%,15%)" }}
                      >
                        <option value="">غير محدد</option>
                        <option value="sem-1">الترم الأول</option>
                        <option value="sem-2">الترم الثاني</option>
                      </select>
                    </div>
                    <Button
                      onClick={handleSave}
                      disabled={saving || uploading}
                      className="w-full bg-primary text-primary-foreground hover:brightness-110"
                    >
                      <Save size={16} className="mr-2" />
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="saved" className="mt-4">
                <SavedListsSidebar
                  onSelectList={handleListSelect}
                  onShareList={handleShareList}
                  className="w-full"
                />
                {selectedListId && (
                  <SavedListView
                    listId={selectedListId}
                    onClose={() => setSelectedListId(null)}
                    onChanged={refreshLists}
                  />
                )}
                <ShareListDialog
                  open={showShareDialog}
                  onClose={() => setShowShareDialog(false)}
                  listId={shareListId}
                  onShare={() => {
                    setShowShareDialog(false);
                    refreshShares();
                  }}
                />
              </TabsContent>

              <TabsContent value="files" className="mt-4 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      ملفاتي ({personalFiles.length})
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      ارفع ملفاتك وشاركها أو اطلب نشرها في الكتالوج
                    </p>
                  </div>
                  <Button onClick={() => setPublishOpen(true)}>
                    <Send className="mr-2 h-4 w-4" />
                    طلب نشر
                  </Button>
                </div>

                <Card className="neon-card bg-card">
                  <CardContent className="p-4">
                    <PersonalUploadZone
                      refreshKey={usageRefreshKey}
                      onFileUploaded={() => {
                        refreshPersonalFiles();
                        refreshRequests();
                      }}
                    />
                  </CardContent>
                </Card>

                <Card className="neon-card bg-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <Files size={18} className="text-primary" />
                      الملفات المرفوعة
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {personalLoading && personalFiles.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        جارٍ تحميل الملفات...
                      </div>
                    ) : personalFiles.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        لا توجد ملفات بعد. استخدم المنطقة أعلاه للرفع.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {personalFiles.map((file) => (
                          <div
                            key={file.id}
                            className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
                          >
                            <button
                              type="button"
                              onClick={() => openMaterial(materialFromPersonalFile(file))}
                              className="rounded-lg bg-muted p-2 text-muted-foreground hover:text-primary"
                              title="معاينة"
                            >
                              <MaterialTypeIcon
                                fileType={file.file_type}
                                mimeType={file.mime_type}
                                url={file.file_url}
                              />
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openMaterial(materialFromPersonalFile(file))}
                                  className="truncate text-right text-sm font-medium text-foreground hover:text-primary"
                                >
                                  {file.title}
                                </button>
                                <span
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-[10px]",
                                    file.is_public
                                      ? "bg-green-500/10 text-green-500"
                                      : "bg-muted text-muted-foreground",
                                  )}
                                >
                                  {file.is_public ? "عام" : "خاص"}
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {(file.file_type || "file").toUpperCase()} •{" "}
                                {formatBytes(file.file_size || 0)} • {formatDate(file.created_at)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              {safeHttpUrl(file.file_url) && (
                                <a
                                  href={safeHttpUrl(file.file_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-primary"
                                  title="فتح"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                              <button
                                className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-primary"
                                title="مشاركة"
                                onClick={() => handleShareFile(file)}
                              >
                                <Share2 className="h-4 w-4" />
                              </button>
                              <button
                                className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-primary"
                                title={file.is_public ? "جعله خاصًا" : "جعله عامًا"}
                                onClick={() => handleTogglePublic(file.id)}
                              >
                                {file.is_public ? (
                                  <Globe className="h-4 w-4" />
                                ) : (
                                  <Lock className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
                                title="حذف"
                                onClick={() => handleDeleteFile(file.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="neon-card bg-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <Clock size={18} className="text-primary" />
                      طلبات النشر
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {requestsLoading && publishRequests.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        جارٍ تحميل الطلبات...
                      </div>
                    ) : publishRequests.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        لا توجد طلبات نشر بعد.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {publishRequests.map((request) => {
                          const isPending = request.status === "pending";
                          const Icon =
                            request.status === "approved"
                              ? CheckCircle2
                              : request.status === "rejected"
                                ? XCircle
                                : Clock;
                          return (
                            <div
                              key={request.id}
                              className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
                            >
                              <Icon
                                className={cn(
                                  "h-5 w-5",
                                  request.status === "approved" && "text-green-500",
                                  request.status === "rejected" && "text-red-500",
                                  (request.status === "pending" ||
                                    request.status === "needs_changes") &&
                                    "text-yellow-500",
                                )}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground">
                                  {statusLabel[request.status] || request.status}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {request.items?.length || 0} ملف • {formatDate(request.created_at)}
                                </p>
                                {request.admin_notes && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    ملاحظات الإدارة: {request.admin_notes}
                                  </p>
                                )}
                              </div>
                              {isPending && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => handleCancelRequest(request.id)}
                                >
                                  إلغاء
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="shares" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-foreground">
                      مشاركاتك ({shares?.length || 0})
                    </h2>
                  </div>
                  {sharesLoading ? (
                    <div className="p-4 text-center text-muted-foreground">
                      Loading shares...
                    </div>
                  ) : shares?.length === 0 ? (
                    <div className="text-center py-8">
                      <Share2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <p className="mt-2 text-muted-foreground">لا توجد مشاركات بعد</p>
                      <p className="text-sm text-muted-foreground/70 mt-1">
                        شارك قوائمك أو ملفاتك مع الآخرين
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {shares?.map((share) => (
                        <div
                          key={share.id}
                          className="p-4 bg-card border border-border rounded-xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                              <Share2 className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p
                                className="truncate font-medium text-foreground"
                                dir="auto"
                                title={
                                  share.list?.name ||
                                  share.file?.title ||
                                  share.materialTitle ||
                                  "مشاركة"
                                }
                              >
                                {share.list?.name ||
                                  share.file?.title ||
                                  share.materialTitle ||
                                  "مشاركة"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {share.permission === "view" ? "عرض فقط" : "عرض وتحميل"}
                              </p>
                            </div>
                          </div>
                          <div className="flex w-full items-center justify-end gap-2 sm:w-auto shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 whitespace-nowrap sm:flex-none"
                              onClick={() => window.open(`/s/${share.token}`, "_blank", "noopener")}
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              فتح
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-400 shrink-0"
                              onClick={async () => {
                                if (!confirm("إبطال رابط المشاركة؟")) return;
                                const ok = await revokeShare(share.token);
                                if (ok) toast.success("تم إبطال الرابط");
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </TabsContent>
              </Tabs>

              <PublishRequestDialog
                open={publishOpen}
                onClose={() => setPublishOpen(false)}
                onSubmitted={refreshRequests}
              />
            </div>
          )}
        </main>
        <Footer />
    </div>
  );
}