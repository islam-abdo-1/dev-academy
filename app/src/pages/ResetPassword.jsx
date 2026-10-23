import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PublicBackground from "@/components/layout/PublicBackground";

const ERROR_MESSAGES = {
  "New password should be different from the old password.":
    "كلمة المرور الجديدة يجب أن تختلف عن القديمة",
  "Password should be at least 6 characters.":
    "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
  "Auth session missing!": "رابط إعادة التعيين غير صالح أو منتهي",
};

export default function ResetPassword() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const submitLock = useRef(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitLock.current) return;
    if (password.length < 8) {
      toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    submitLock.current = false;
    setSubmitting(false);
    if (error) {
      toast.error(ERROR_MESSAGES[error.message] || error.message);
      return;
    }
    setDone(true);
    toast.success("تم تحديث كلمة المرور بنجاح");
    await supabase.auth.signOut({ scope: "local" });
  };

  const content = done ? (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
        <CheckCircle2 size={26} className="text-primary" />
      </div>
      <div>
        <h1 className="text-xl font-bold">تم تحديث كلمة المرور</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.
        </p>
      </div>
      <Button className="w-full gap-2" onClick={() => navigate("/login", { replace: true })}>
        الانتقال لتسجيل الدخول
        <ArrowRight size={16} />
      </Button>
    </div>
  ) : authLoading ? (
    <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
      <LoaderCircle size={24} className="animate-spin text-primary" />
      جارٍ التحقق من رابط إعادة التعيين...
    </div>
  ) : !user ? (
    <div className="space-y-5 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
        <ShieldAlert size={26} className="text-destructive" />
      </div>
      <div>
        <h1 className="text-xl font-bold">رابط غير صالح أو منتهي</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          اطلب رابط إعادة تعيين جديد من صفحة تسجيل الدخول.
        </p>
      </div>
      <Button asChild className="w-full">
        <Link to="/login">العودة لتسجيل الدخول</Link>
      </Button>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
          <KeyRound size={20} className="text-primary" />
        </div>
        <h1 className="text-xl font-bold">تعيين كلمة مرور جديدة</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          اختر كلمة مرور قوية لا تستخدمها في مواقع أخرى.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
        <div className="relative">
          <Input
            id="new-password"
            type={showPassword ? "text" : "password"}
            dir="ltr"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">تأكيد كلمة المرور</Label>
        <Input
          id="confirm-password"
          type={showPassword ? "text" : "password"}
          dir="ltr"
          autoComplete="new-password"
          minLength={8}
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </div>

      <Button type="submit" className="w-full gap-2" disabled={submitting}>
        {submitting ? <LoaderCircle size={16} className="animate-spin" /> : <KeyRound size={16} />}
        حفظ كلمة المرور
      </Button>
    </form>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <PublicBackground />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center gap-3">
            <img
              src="/logo-mark.webp"
              alt="Dev Academy"
              className="h-16 w-16 rounded-2xl border border-primary/30 object-cover"
            />
            <span className="text-xl font-bold">Dev Academy</span>
          </div>
          <div className="neon-card rounded-2xl border border-border/60 bg-card/80 p-6 backdrop-blur sm:p-8">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}
