import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Brain,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import PublicBackground from "@/components/layout/PublicBackground";

const ERROR_MESSAGES = {
  "provider is not enabled": "تسجيل الدخول بجوجل غير مفعّل حالياً",
  "captcha verification process failed":
    "فشل التحقق الأمني — أعد المحاولة",
  "captcha protection: request disallowed":
    "فشل التحقق الأمني — أعد المحاولة",
};

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
  const [googleLoading, setGoogleLoading] = useState(false);

  const requestedFrom = location.state?.from?.pathname;
  const from =
    !requestedFrom || requestedFrom.startsWith("/login") ? "/" : requestedFrom;

  useEffect(() => {
    if (!authLoading && user) navigate(from, { replace: true });
  }, [user, authLoading, from, navigate]);

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
              <div className="mb-6 text-center">
                <h1 className="text-xl font-bold">تسجيل الدخول</h1>
                <p dir="rtl" className="mt-2 text-sm text-muted-foreground">
                  استخدم حساب Google للدخول أو إنشاء حساب جديد.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGoogle}
                disabled={googleLoading || authLoading}
                className="w-full flex items-center justify-center gap-3 h-11 rounded-lg border border-border bg-background/60 hover:bg-muted/40 transition-colors text-sm font-medium disabled:opacity-60"
              >
                {googleLoading ? (
                  <LoaderCircle className="animate-spin" size={18} />
                ) : (
                  <GoogleIcon />
                )}
                المتابعة باستخدام Google
              </button>

              <div
                dir="rtl"
                className="mt-6 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground"
              >
                لا نستخدم كلمات مرور أو رسائل بريدية. تسجيل الدخول وإنشاء
                الحساب يتمّان مباشرةً من خلال Google.
              </div>
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
