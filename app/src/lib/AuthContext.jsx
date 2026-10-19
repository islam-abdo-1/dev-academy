import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "./supabase";

const AuthContext = createContext({
  session: null,
  user: null,
  profile: null,
  loading: true,
  profileError: null,
  isStaff: false,
  isSuperAdmin: false,
  signOut: async () => {},
  refreshProfile: async () => null,
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setLoading(false);
      });
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      },
    );
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      setProfileError(null);
      return null;
    }
    setProfileError(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const { data: healed } = await supabase.rpc("ensure_my_profile");
        const healedRow = Array.isArray(healed) ? healed[0] : healed;
        setProfile(healedRow ?? null);
        return healedRow ?? null;
      }
      setProfile(data ?? null);
      return data ?? null;
    } catch {
      setProfileError(
        "تعذّر تحميل بيانات حسابك — تأكد من اتصالك بالإنترنت وحاول تاني",
      );
      return null;
    }
  }, [session?.user?.id]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const value = useMemo(() => {
    const role = profile?.role;
    return {
      session,
      user: session?.user ?? null,
      profile,
      loading,
      profileError,
      isStaff: role === "admin" || role === "super_admin",
      isSuperAdmin: role === "super_admin",
      signOut: () => supabase.auth.signOut(),
      refreshProfile,
    };
  }, [session, profile, loading, profileError, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
