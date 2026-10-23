import { lazy, Suspense, useEffect, useState } from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "./lib/AuthContext";
import ConnectionError from "./components/ConnectionError";
import SeoManager from "./components/SeoManager";
import Home from "./pages/Home";

const WelcomeOverlay = lazy(() =>
  import("./components/dashboard/WelcomeOverlay"),
);

const Explore = lazy(() => import("./pages/Explore"));
const BrowseMajor = lazy(() => import("./pages/BrowseMajor"));
const BrowseYear = lazy(() => import("./pages/BrowseYear"));
const BrowseSemester = lazy(() => import("./pages/BrowseSemester"));
const Profile = lazy(() => import("./pages/Profile"));
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const DashboardLayout = lazy(() => import("./pages/DashboardLayout"));
const DashboardHome = lazy(() => import("./pages/DashboardHome"));
const DashboardSubjects = lazy(() => import("./pages/DashboardSubjects"));
const DashboardResources = lazy(() => import("./pages/DashboardResources"));
const DashboardTeam = lazy(() => import("./pages/DashboardTeam"));
const DashboardSettings = lazy(() => import("./pages/DashboardSettings"));
const SubjectDetail = lazy(() => import("./pages/SubjectDetail"));
const DashboardPublishRequests = lazy(() => import("./pages/DashboardPublishRequests"));
const DashboardStorage = lazy(() => import("./pages/DashboardStorage"));
const Legal = lazy(() => import("./pages/Legal"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PublicShareView = lazy(() =>
  import("./components/share/PublicShareView").then((module) => ({
    default: module.PublicShareView,
  })),
);

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoaderCircle size={28} className="animate-spin text-primary" />
    </div>
  );
}

function RequireAuth() {
  const { user, loading, profileError, refreshProfile } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (profileError) {
    return (
      <ConnectionError
        fullPage
        message={profileError}
        onRetry={refreshProfile}
      />
    );
  }
  return <Outlet />;
}

function RequireStaff() {
  const { user, profile, isStaff, loading, profileError, refreshProfile } =
    useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (profileError && !profile) {
    return (
      <ConnectionError
        fullPage
        message={profileError}
        onRetry={refreshProfile}
      />
    );
  }
  if (!profile) return <FullPageLoader />;
  if (!isStaff) return <Navigate to="/" replace />;
  return <Outlet />;
}

function RequireSuperAdmin() {
  const { isSuperAdmin, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

function HomeEntryGuard() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (document.cookie.includes("dev_academy_launch=1")) return;
    document.cookie = "dev_academy_launch=1; path=/; SameSite=Lax";
    const isPrivateEntry =
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/") ||
      pathname === "/profile" ||
      pathname.startsWith("/profile/") ||
      pathname === "/admin" ||
      pathname.startsWith("/admin/");
    if (isPrivateEntry) navigate("/", { replace: true });
  }, [navigate, pathname]);

  return null;
}

export default function App() {
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowOverlay(true), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <SeoManager />
      <HomeEntryGuard />
      <Suspense fallback={<FullPageLoader />}>
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/s/:token" element={<PublicShareView />} />
        <Route path="/privacy" element={<Legal />} />
        <Route path="/terms" element={<Legal />} />
        <Route path="/:major" element={<BrowseMajor />} />
        <Route path="/:major/:year" element={<BrowseYear />} />
        <Route path="/:major/:year/:sem" element={<BrowseSemester />} />
        <Route element={<RequireAuth />}>
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route element={<RequireStaff />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardHome />} />
            <Route path="subjects" element={<DashboardSubjects />} />
            <Route path="resources" element={<DashboardResources />} />
            <Route path="team" element={<DashboardTeam />} />
            <Route path="settings" element={<DashboardSettings />} />
            <Route path="publish-requests" element={<DashboardPublishRequests />} />
            <Route element={<RequireSuperAdmin />}>
              <Route path="storage" element={<DashboardStorage />} />
            </Route>
            <Route path="subjects/:subjectId" element={<SubjectDetail />} />
          </Route>
          <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/admin/publish-requests"
            element={<Navigate to="/dashboard/publish-requests" replace />}
          />
          <Route path="/admin/storage" element={<Navigate to="/dashboard/storage" replace />} />
        </Route>
        <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      {showOverlay && (
        <Suspense fallback={null}>
          <WelcomeOverlay />
        </Suspense>
      )}
    </>
  );
}
