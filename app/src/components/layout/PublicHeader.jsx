import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import NotificationBell from "@/components/dashboard/NotificationBell";
import PublicSearchDialog from "./PublicSearchDialog";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "About", href: "#about" },
  { label: "Explore", href: "/explore" },
];

const BUTTON_CLASS =
  "bg-primary text-primary-foreground px-4 py-2 text-sm font-medium opacity-100 rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow hover:bg-primary/90 h-9 hover:brightness-110";

function getInitials(name, email) {
  const source = (name || email || "").trim();
  if (!source) return "؟";
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export default function PublicHeader({ onSearchOpen }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, isStaff } = useAuth();

  const openSearch = () => {
    if (onSearchOpen) onSearchOpen();
    else setSearchOpen(true);
  };

  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        openSearch();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleAnchorClick = (event, href) => {
    event.preventDefault();
    setMobileOpen(false);
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
      }, 300);
    } else {
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 border-b border-border/30"
      style={{
        backdropFilter: "blur(12px)",
        background: "hsla(240, 50%, 3%, 0.6)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/logo-mark.png"
              alt="Dev Academy Logo"
              style={{
                height: "40px",
                width: "40px",
                objectFit: "contain",
                borderRadius: "10px",
                border: "1px solid hsla(190,100%,50%,0.3)",
              }}
            />
            <span
              className="hidden sm:block font-semibold text-lg"
              style={{
                fontFamily: "JetBrains Mono, monospace",
                color: "hsl(190, 100%, 50%)",
                letterSpacing: "0.05em",
              }}
            >
              Dev Academy
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((item) =>
              item.href.startsWith("/") ? (
                <Link
                  key={item.href}
                  to={item.href}
                  className="text-muted-foreground hover:text-primary text-sm font-medium transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(event) => handleAnchorClick(event, item.href)}
                  className="text-muted-foreground hover:text-primary text-sm font-medium transition-colors cursor-pointer"
                >
                  {item.label}
                </a>
              ),
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openSearch}
              aria-label="بحث"
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all border border-border/50 hover:border-primary/30"
            >
              <Search size={14} />
              <span>Search</span>
              <kbd className="px-1.5 py-0.5 rounded bg-muted/50 border border-border/50 text-xs">
                ⌘K
              </kbd>
            </button>

            <NotificationBell userEmail={profile?.email || user?.email || ""} />

            {!user && (
              <Link to="/login">
                <Button
                  className={BUTTON_CLASS}
                  style={{ boxShadow: "0 0 12px hsla(190, 100%, 50%, 0.3)" }}
                >
                  تسجيل الدخول
                </Button>
              </Link>
            )}

            {user && isStaff && (
              <Link to="/dashboard">
                <Button
                  className={BUTTON_CLASS}
                  style={{ boxShadow: "0 0 12px hsla(190, 100%, 50%, 0.3)" }}
                >
                  Admin Panel ⚙️
                </Button>
              </Link>
            )}

            {user && !isStaff && (
              <Link
                to="/profile"
                title="ملفي الشخصي"
                aria-label="ملفي الشخصي"
                className="w-9 h-9 rounded-full overflow-hidden border border-primary/40 bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold hover:brightness-125 transition-all"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile?.full_name || "Profile"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getInitials(profile?.full_name, profile?.email || user.email)
                )}
              </Link>
            )}

            <button
              aria-label={mobileOpen ? "إغلاق القائمة" : "فتح القائمة"}
              className="md:hidden p-2 text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
              onClick={() => setMobileOpen((value) => !value)}
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {!onSearchOpen && (
        <PublicSearchDialog
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {mobileOpen && (
        <div className="md:hidden border-t border-border/30 bg-background/95 backdrop-blur-lg">
          <div className="px-4 py-4 space-y-3">
            <button
              onClick={() => {
                setMobileOpen(false);
                openSearch();
              }}
              className="flex items-center gap-2 text-muted-foreground hover:text-primary text-sm font-medium py-2 min-h-[44px] w-full"
            >
              <Search size={16} /> Search
            </button>
            {NAV_LINKS.map((item) =>
              item.href.startsWith("/") ? (
                <Link
                  key={item.href}
                  to={item.href}
                  className="block text-muted-foreground hover:text-primary text-sm font-medium py-2 min-h-[44px] flex items-center"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={(event) => handleAnchorClick(event, item.href)}
                  className="block text-muted-foreground hover:text-primary text-sm font-medium py-2 min-h-[44px] flex items-center cursor-pointer"
                >
                  {item.label}
                </a>
              ),
            )}
            {!user && (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="block text-primary text-sm font-semibold py-2 min-h-[44px] flex items-center border-t border-border/30 pt-3"
              >
                تسجيل الدخول / إنشاء حساب
              </Link>
            )}
            {user && (
              <Link
                to="/profile"
                onClick={() => setMobileOpen(false)}
                className="block text-muted-foreground hover:text-primary text-sm font-medium py-2 min-h-[44px] flex items-center border-t border-border/30 pt-3"
              >
                ملفي الشخصي
              </Link>
            )}
            {user && isStaff && (
              <Link
                to="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="block text-muted-foreground hover:text-primary text-sm font-medium py-2 min-h-[44px] flex items-center"
              >
                لوحة التحكم
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
