import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
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
  "provider is not enabled": "تسجيل الدخول بجوجل قيد التجهيز حالياً",
  "captcha verification process failed":
    "فشل التحقق الأمني — أعد المحاولة",
  "captcha protection: request disallowed":
    "فشل التحقق الأمني — أعد المحاولة",
};

const RESET_COOLDOWN_KEY = "da-reset-cooldown-until";
const RESET_COOLDOWN_MS = 60_000;

const FEATURES = [
  { icon: Brain, text: "مسارات متخصصة في الذكاء الاصطناعي والأمن السيبراني" },
  { icon: ShieldCheck, text: "محتوى نخبوي منظّم — محاضرة بمحاضرة" },
  { icon: Sparkles, text: "تابع تقدمك واحفظ موادك المفضلة في مكان واحد" },
];

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20.5H24v7h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5-5C33.6 7.6 29 5.5 24 5.5 13.8 5.5 5.5 13.8 5.5 24S13.8 42.5 24 42.5 42.5 34.2 42.5 24c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M8.3 14.7l5.7 4.2C15.7 15.1 19.5 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5-5C33.6 7.6 29 5.5 24 5.5c-7.4 0-13.8 4.2-17 10.4z"
      />
      <path
        fill="#4CAF50"
        d="M24 42.5c5 0 9.5-1.9 12.9-5l-6-5.1c-2 1.6-4.5 2.6-6.9 2.6-5.3 0-9.7-3.1-11.3-7.6l-5.7 4.4C10.2 38.2 16.6 42.5 24 42.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20.5H24v7h11.3c-.8 2.3-2.3 4.3-4.3 5.6l6 5.1c-.4.4 6.5-4.7 6.5-14.2 0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const captchaRequired = isTurnstileEnabled();
  const [cooldownUntil, setCooldownUntil] = useState(() => {
    const stored = Number(localStorage.getItem(RESET_COOLDOWN_KEY));
    return Number.isFinite(stored) ? stored : 0;
  });
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return undefined;
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [cooldownUntil]);

  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - nowTick) / 1000));

  const requestedFrom = location.state?.from?.pathname;
  const from =
    !requestedFrom || requestedFrom.startsWith("/login") ? "/" : requestedFrom;

  useEffect(() => {
    if (!authLoading && user) navigate(from, { replace: true });
  }, [user, authLoading, from, navigate]);

  const switchMode = (next) => {
    setMode(next);
    setShowPassword(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: captchaToken || undefined },
    });
    setLoading(false);
    if (error) {
      setCaptchaReset((n) => n + 1);
      toast.error(ERROR_MESSAGES[error.message] || error.message);
      return;
    }
    toast.success("تم تسجيل الدخول بنجاح");
    navigate(from, { replace: true });
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setGoogleLoading(false);
      toast.error(
        ERROR_MESSAGES[error.message] ||
          "تعذّر بدء تسجيل الدخول بجوجل — حاول مرة أخرى",
      );
    }
  };

  const handleForgot = async () => {
    if (!email) {
      toast.error("أدخل بريدك الإلكتروني أولاً");
      return;
    }
    if (cooldownLeft > 0) return;
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
      captchaToken: captchaToken || undefined,
    });
    setSending(false);
    if (error) {
      setCaptchaReset((n) => n + 1);
      toast.error(ERROR_MESSAGES[error.message] || error.message);
      return;
    }
    const until = Date.now() + RESET_COOLDOWN_MS;
    localStorage.setItem(RESET_COOLDOWN_KEY, String(until));
    setCooldownUntil(until);
    toast.success("تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني");
  };

  const googleButton = (
    <button
      type="button"
      onClick={handleGoogle}
      disabled={googleLoading}
      className="w-full flex items-center justify-center gap-3 h-11 rounded-lg border border-border bg-background/60 hover:bg-muted/40 transition-colors text-sm font-medium disabled:opacity-60"
    >
      {googleLoading ? (
        <LoaderCircle className="animate-spin" size={18} />
      ) : (
        <GoogleIcon />
      )}
      المتابعة باستخدام Google
    </button>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <PublicBackground />
      <div className="relative z-10 flex min-h-screen">
        <div className="hidden lg:flex lg:w-[46%] flex-col items-center justify-center gap-10 px-12">
          <img
            src="/logo-full.jpg"
            alt="Dev Academy"
            className="w-full max-w-sm rounded-2xl"
            style={{
              border: "1px solid hsla(190,100%,50%,0.25)",
              boxShadow: "0 0 60px hsla(190,100%,50%,0.12)",
            }}
          />
          <ul className="space-y-4 max-w-sm w-full">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-3 text-sm text-muted-foreground"
              >
                <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Icon size={16} className="text-primary" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
              <img
                src="/logo-mark.webp"
                alt="Dev Academy"
                className="h-16 w-16 rounded-2xl object-cover border border-primary/30"
              />
              <h1 className="text-xl font-bold">Dev Academy</h1>
            </div>

            <div className="neon-card rounded-2xl border border-border/60 bg-card/80 p-6 sm:p-8 backdrop-blur">
              {mode !== "forgot" && (
                <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-muted/40 p-1 border border-border/50">
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                      mode === "login"
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    تسجيل الدخول
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("signup")}
                    className={`h-9 rounded-lg text-sm font-medium transition-colors ${
                      mode === "signup"
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    إنشاء حساب
                  </button>
                </div>
              )}

              {mode === "login" && (
                <>
                  {googleButton}
                  <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border/60" />
                    أو
                    <span className="h-px flex-1 bg-border/60" />
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">البريد الإلكتروني</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        dir="ltr"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">كلمة المرور</Label>
                        <button
                          type="button"
                          onClick={() => switchMode("forgot")}
                          className="text-xs text-primary hover:underline"
                        >
                          نسيت كلمة المرور؟
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          required
                          dir="ltr"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff size={16} />
                          ) : (
                            <Eye size={16} />
                          )}
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
                </>
              )}

              {mode === "signup" && (
                <div className="space-y-5">
                  {googleButton}
                  <div className="text-center space-y-2">
                    <h2 className="text-lg font-bold">أنشئ حسابك مجاناً</h2>
                    <p className="text-sm text-muted-foreground">
                      بضغطة واحدة باستخدام حساب Google — بدون كلمة مرور جديدة.
                    </p>
                  </div>
                  <ul className="space-y-3">
                    {[
                      "احفظ مسارك الدراسي وموادك المفضلة",
                      "تابع تقدمك محاضرة بمحاضرة",
                      "وصول كامل لمحتوى تخصصك",
                    ].map((text) => (
                      <li
                        key={text}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <CheckCircle2
                          size={15}
                          className="text-primary flex-shrink-0"
                        />
                        {text}
                      </li>
                    ))}
                  </ul>
                  <p className="text-center text-xs text-muted-foreground">
                    لديك حساب بالفعل؟{" "}
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className="text-primary hover:underline"
                    >
                      سجّل الدخول
                    </button>
                  </p>
                </div>
              )}

              {mode === "forgot" && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                      <KeyRound size={20} className="text-primary" />
                    </div>
                    <h2 className="text-lg font-bold">استعادة كلمة المرور</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">البريد الإلكتروني</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      required
                      dir="ltr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <Turnstile
                    onToken={setCaptchaToken}
                    resetSignal={captchaReset}
                  />
                  <Button
                    type="button"
                    onClick={handleForgot}
                    disabled={
                      sending ||
                      cooldownLeft > 0 ||
                      (captchaRequired && !captchaToken)
                    }
                    className="w-full gap-2 h-11"
                  >
                    {sending ? (
                      <LoaderCircle className="animate-spin" size={16} />
                    ) : (
                      <Mail size={16} />
                    )}
                    {cooldownLeft > 0
                      ? `حاول مجدداً بعد ${cooldownLeft} ث`
                      : "إرسال رابط الاستعادة"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ArrowLeft size={12} />
                    رجوع لتسجيل الدخول
                  </button>
                </div>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              <Link to="/" className="hover:text-primary transition-colors">
                العودة إلى الصفحة الرئيسية
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
