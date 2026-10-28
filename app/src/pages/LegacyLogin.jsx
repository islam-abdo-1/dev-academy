import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LogIn,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/AuthContext";
import PublicBackground from "@/components/layout/PublicBackground";
import Turnstile, { isTurnstileEnabled } from "@/components/Turnstile";

const ERROR_MESSAGES = {
  "Invalid login credentials":
    "بيانات الدخول غير صحيحة — تأكد من البريد الإلكتروني وكلمة المرور",
  "Email not confirmed": "بريدك الإلكتروني غير مُفعّل بعد",
  "Email rate limit exceeded": "محاولات كثيرة — حاول مرة أخرى بعد قليل",
  "provider is not enabled": "دخول البريد الإلكتروني غير مفعّل حالياً",
  "captcha verification process failed":
    "فشل التحقق الأمني — أعد المحاولة",
  "captcha protection: request disallowed":
    "فشل التحقق الأمني — أعد المحاولة",
};

export default function LegacyLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const captchaRequired = isTurnstileEnabled();

  const requestedFrom = location.state?.from?.pathname;
  const from =
    !requestedFrom || requestedFrom.startsWith("/legacy-login")
      ? "/"
      : requestedFrom;

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    if (!authLoading && user) navigate(from, { replace: true });
  }, [user, authLoading, from, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: captchaToken || undefined },
    });
    setLoading(false);
    if (error) {
      setCaptchaReset((value) => value + 1);
      toast.error(ERROR_MESSAGES[error.message] || error.message);
      return;
    }
    toast.success("تم تسجيل الدخول بنجاح");
    navigate(from, { replace: true });
  };

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
            <h1 className="text-xl font-bold">Dev Academy</h1>
          </div>

          <div className="neon-card rounded-2xl border border-border/60 bg-card/80 p-6 backdrop-blur sm:p-8">
            <div className="mb-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                <KeyRound size={20} className="text-primary" />
              </div>
              <h2 className="text-lg font-bold">دخول الحسابات القديمة</h2>
              <p dir="rtl" className="mt-1 text-xs text-muted-foreground">
                هذا الدخول مؤقت للحسابات الموجودة قبل تفعيل Google. استخدم
                الدخول بجوجل للحسابات الجديدة.
              </p>
            </div>

            <form onSubmit={handleSubmit} dir="rtl" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="legacy-email">البريد الإلكتروني</Label>
                <Input
                  id="legacy-email"
                  type="email"
                  required
                  dir="ltr"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legacy-password">كلمة المرور</Label>
                <div className="relative">
                  <Input
                    id="legacy-password"
                    type={showPassword ? "text" : "password"}
                    required
                    dir="ltr"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={
                      showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                    }
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <Turnstile
                onToken={setCaptchaToken}
                resetSignal={captchaReset}
              />
              <Button
                type="submit"
                disabled={loading || (captchaRequired && !captchaToken)}
                className="w-full gap-2 h-11"
              >
                {loading ? (
                  <LoaderCircle className="animate-spin" size={16} />
                ) : (
                  <LogIn size={16} />
                )}
                تسجيل الدخول
              </Button>
            </form>

            <Link
              to="/login"
              className="mx-auto mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft size={12} />
              العودة إلى الدخول بجوجل
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
