import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
let supabasePromise;
function loadSupabase() {
  if (!supabasePromise) {
    supabasePromise = import("./supabase")
      .then((module) => module.supabase)
      .catch((error) => {
        supabasePromise = undefined;
        throw error;
      });
  }
  return supabasePromise;
}

/**
 * @typedef {Object} AuthContextValue
 * @property {import('@supabase/supabase-js').Session | null} session
 * @property {import('@supabase/supabase-js').User | null} user
 * @property {Record<string, any> | null} profile
 * @property {boolean} loading
 * @property {string | null} profileError
 * @property {boolean} isStaff
 * @property {boolean} isSuperAdmin
 * @property {() => Promise<{ error: Error | null }>} signOut
 * @property {() => Promise<Record<string, any> | null>} refreshProfile
 */

/** @type {import('react').Context<AuthContextValue>} */
const AuthContext = createContext({
  session: null,
  user: null,
  profile: null,
  loading: true,
  profileError: null,
  isStaff: false,
  isSuperAdmin: false,
  signOut: async () => ({ error: null }),
  refreshProfile: async () => null,
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    let mounted = true;
    let subscription;
    loadSupabase()
      .then(async (client) => {
        if (!mounted) return;
        const { data: sub } = client.auth.onAuthStateChange(
          (_event, newSession) => {
            if (mounted) setSession(newSession);
          },
        );
        subscription = sub.subscription;
        const { data } = await client.auth.getSession();
        if (!mounted) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
      subscription?.unsubscribe();
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
      const client = await loadSupabase();
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const { data: healed } = await client.rpc("ensure_my_profile");
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
      signOut: () => loadSupabase().then((client) => client.auth.signOut()),
      refreshProfile,
    };
  }, [session, profile, loading, profileError, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
