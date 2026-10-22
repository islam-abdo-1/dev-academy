import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheckBig, Info, TriangleAlert, X, Zap } from "lucide-react";
import { db } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

const DISMISSED_KEY = "dismissed_announcements";

const ANNOUNCEMENT_STYLES = {
  info: {
    icon: Info,
    color: "hsl(190,100%,50%)",
    bg: "hsl(240,30%,8%)",
    border: "hsla(190,100%,50%,0.4)",
    glow: "hsla(190,100%,50%,0.2)",
  },
  warning: {
    icon: TriangleAlert,
    color: "hsl(38,100%,55%)",
    bg: "hsl(240,30%,8%)",
    border: "hsla(38,100%,55%,0.4)",
    glow: "hsla(38,100%,55%,0.2)",
  },
  success: {
    icon: CircleCheckBig,
    color: "hsl(160,60%,50%)",
    bg: "hsl(240,30%,8%)",
    border: "hsla(160,60%,50%,0.4)",
    glow: "hsla(160,60%,50%,0.2)",
  },
  critical: {
    icon: Zap,
    color: "hsl(0,84%,60%)",
    bg: "hsl(240,30%,8%)",
    border: "hsla(0,84%,60%,0.4)",
    glow: "hsla(0,84%,60%,0.2)",
  },
};

const normalizeToken = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function matchesPath(path, pathname) {
  if (!path) return true;
  const parts = path.split("_");
  const scopeMajor =
    parts[0] && parts[0] !== "all" ? normalizeToken(parts[0]) : null;
  const scopeYear =
    parts[1] && parts[1] !== "all" ? normalizeToken(parts[1]) : null;
  if (!scopeMajor && !scopeYear) return true;
  const route = pathname.split("/").filter(Boolean);
  if (scopeMajor && normalizeToken(route[0]) !== scopeMajor) return false;
  if (scopeYear && normalizeToken(route[1]) !== scopeYear) return false;
  return true;
}

function getDismissed(storageKey) {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "[]");
  } catch {
    return [];
  }
}

function saveDismissed(storageKey, id) {
  const dismissed = getDismissed(storageKey);
  if (dismissed.includes(id)) return;
  localStorage.setItem(storageKey, JSON.stringify([...dismissed, id]));
}

export default function WelcomeOverlay() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const dismissedKey = `${DISMISSED_KEY}:${user?.id || "anon"}`;

  useEffect(() => {
    const load = () => {
      db.filter(
        "announcements",
        { pinned: true },
        { order: "created_date", asc: false, limit: 20 },
      )
        .then((data) => {
          const dismissed = getDismissed(dismissedKey);
          setAnnouncements(
            (data || [])
              .filter(
                (item) =>
                  !dismissed.includes(item.id) &&
                  matchesPath(item.path, pathname),
              )
              .slice(0, 5),
          );
        })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [pathname, user?.id]);

  const dismiss = (id) => {
    saveDismissed(dismissedKey, id);
    setAnnouncements((list) => list.filter((item) => item.id !== id));
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-10 flex flex-col gap-3 w-full max-w-xl px-4 pointer-events-none">
      <AnimatePresence>
        {announcements.map((announcement) => {
          const style =
            ANNOUNCEMENT_STYLES[announcement.type] || ANNOUNCEMENT_STYLES.info;
          const Icon = style.icon;
          return (
            <motion.div
              key={announcement.id}
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto rounded-xl px-4 py-3 flex items-start gap-3 border shadow-lg"
              style={{
                background: style.bg,
                borderColor: style.border,
                boxShadow: `0 0 24px ${style.glow}, 0 4px 20px rgba(0,0,0,0.4)`,
              }}
            >
              <div className="relative flex-shrink-0 mt-0.5">
                <Icon size={18} style={{ color: style.color }} />
                <span
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2"
                  style={{
                    background: style.color,
                    borderColor: style.bg,
                    animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-xs font-mono font-bold uppercase tracking-wider"
                    style={{ color: style.color }}
                  >
                    📢 إعلان هام
                  </span>
                </div>
                <p className="text-sm font-bold text-foreground">
                  {announcement.title}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap leading-relaxed">
                  {announcement.body}
                </p>
              </div>
              <button
                onClick={() => dismiss(announcement.id)}
                aria-label="إغلاق الإعلان"
                className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
              >
                <X size={15} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
