import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { useAuth } from "./lib/AuthContext";
import ConnectionError from "./components/ConnectionError";
import WelcomeOverlay from "./components/dashboard/WelcomeOverlay";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import BrowseMajor from "./pages/BrowseMajor";
import BrowseYear from "./pages/BrowseYear";
import BrowseSemester from "./pages/BrowseSemester";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import DashboardLayout from "./pages/DashboardLayout";
import DashboardHome from "./pages/DashboardHome";
import DashboardSubjects from "./pages/DashboardSubjects";
import DashboardResources from "./pages/DashboardResources";
import DashboardTeam from "./pages/DashboardTeam";
import DashboardSettings from "./pages/DashboardSettings";
import SubjectDetail from "./pages/SubjectDetail";
import NotFound from "./pages/NotFound";

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

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
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
            <Route path="subjects/:subjectId" element={<SubjectDetail />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <WelcomeOverlay />
    </>
  );
}
