import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BrainCircuit,
  Camera,
  CircleDashed,
  House,
  Save,
  ShieldCheck,
  User,
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

export default function Profile() {
  const { profile, user, loading, profileError, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    full_name: "",
    major: "",
    year: "",
    semester: "",
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

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
    const allowedTypes = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    };
    const extension = allowedTypes[file.type];
    if (!extension) {
      toast.error("صيغة الصورة غير مدعومة — استخدم PNG أو JPG أو WEBP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة كبير جداً — الحد الأقصى 5 ميجابايت");
      return;
    }
    setUploading(true);
    try {
      const path = `avatars/${user.id}.${extension}`;
      const { error } = await supabase.storage
        .from("media")
        .upload(path, file, { upsert: true, cacheControl: "300" });
      if (error) throw error;
      const { data } = supabase.storage.from("media").getPublicUrl(path);
      const versionedUrl = `${data.publicUrl}?v=${Date.now()}`;
      await db.update("profiles", user.id, { avatar_url: versionedUrl });
      await refreshProfile();
      toast.success("تم تحديث الصورة الشخصية بنجاح!");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const majorBadge = ((major) =>
    major === "ai"
      ? {
          Icon: BrainCircuit,
          label: "Artificial Intelligence",
          color: "hsl(190, 100%, 50%)",
          border: "hsla(190, 100%, 50%, 0.35)",
          background: "hsla(190, 100%, 50%, 0.08)",
        }
      : major === "cybersecurity"
        ? {
            Icon: ShieldCheck,
            label: "Cybersecurity",
            color: "hsl(160, 60%, 50%)",
            border: "hsla(160, 60%, 50%, 0.35)",
            background: "hsla(160, 60%, 50%, 0.08)",
          }
        : {
            Icon: CircleDashed,
            label: "Major not set",
            color: "hsl(215, 20%, 55%)",
            border: "hsla(215, 20%, 55%, 0.35)",
            background: "hsla(215, 20%, 55%, 0.08)",
          })(form.major);

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
            src="/logo-mark.png"
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
      <main className="pt-24 pb-16 px-4 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">My Profile</h1>
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
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
