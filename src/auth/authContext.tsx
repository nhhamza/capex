import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/firebase/client";
import { backendApi } from "@/lib/backendApi";

// Ajusta este type a tu modelo real si ya lo tienes importado de otro sitio
export type UserDoc = {
  id?: string;
  email?: string | null;
  orgId?: string;
  organizationId?: string;
  role?: string;
  [k: string]: any;
} | null;

type AuthCtx = {
  user: User | null;
  userDoc: UserDoc;
  loading: boolean;

  /**
   * True cuando el backend indica que el usuario no tiene perfil/org inicializado
   * (o el perfil no se puede resolver). La UI puede enviar a /setup-org,
   * pero OJO: setup-org solo debe crear org en signup/onboarding.
   */
  needsOnboarding: boolean;

  logout: () => Promise<void>;
  refreshUserDoc: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  userDoc: null,
  loading: true,
  needsOnboarding: false,
  logout: async () => {},
  refreshUserDoc: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const fetchMe = async (retryCount = 0): Promise<UserDoc> => {
    try {
      const me = await backendApi.get("/api/me");
      return (me.data?.user ?? null) as UserDoc;
    } catch (error: any) {
      // If it's a network error and we haven't retried too many times, retry
      const isNetworkError = !error?.response || error?.code === 'ERR_NETWORK' || error?.code === 'ETIMEDOUT' || error?.code === 'ECONNABORTED';

      if (isNetworkError && retryCount < 2) {
        console.log(`[Auth] Network error, retrying (${retryCount + 1}/2)...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Progressive backoff
        return fetchMe(retryCount + 1);
      }

      throw error;
    }
  };

  const refreshUserDoc = async () => {
    // Check if there's a current Firebase user (even if context state hasn't updated yet)
    const currentUser = auth.currentUser;
    if (!currentUser && !user) return;

    try {
      // Force token refresh before fetching user doc
      if (currentUser) {
        await currentUser.getIdToken(true);
      }

      const me = await fetchMe();
      setUserDoc(me);
      setNeedsOnboarding(false);
    } catch (e: any) {
      const status = e?.response?.status;
      const code = e?.response?.data?.error;
      const isNetworkError = !e?.response || e?.code === 'ERR_NETWORK' || e?.code === 'ERR_CONNECTION_RESET' || e?.code === 'ETIMEDOUT' || e?.code === 'ECONNABORTED';

      // Only logout on 401 (invalid token), not on network errors
      // Network errors could be temporary (cold start, connection issues)
      if (status === 401) {
        console.error("[Auth] Invalid token in refreshUserDoc. Logging out...", {
          code: e?.code,
          status,
        });
        await auth.signOut();
        setUserDoc(null);
        setNeedsOnboarding(false);
        return;
      }

      // Don't logout on network errors - just log and keep session
      if (isNetworkError) {
        console.warn("[Auth] Network error in refreshUserDoc (keeping session):", {
          code: e?.code,
          message: e?.message,
        });
        // Keep existing userDoc if any
        return;
      }

      if (status === 403 || (status === 409 && code === "not_initialized")) {
        setUserDoc(null);
        setNeedsOnboarding(true);
        return;
      }

      console.error("[Auth] refreshUserDoc failed:", e);
    }
  };

  const logout = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.error("[Auth] logout failed", err);
    }
  };

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      setUser(u);

      // reset session state
      setUserDoc(null);
      setNeedsOnboarding(false);

      if (!u) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // Force token refresh on login to ensure fresh token
        await u.getIdToken(true);

        // 1) Try normal /api/me with retries built into fetchMe
        try {
          const me = await fetchMe();
          setUserDoc(me);
          setNeedsOnboarding(false);
          return;
        } catch (e: any) {
          const status = e?.response?.status;
          const code = e?.response?.data?.error;
          const isNetworkError = !e?.response || e?.code === 'ERR_NETWORK' || e?.code === 'ERR_CONNECTION_RESET' || e?.code === 'ETIMEDOUT' || e?.code === 'ECONNABORTED';

          // Network error on initial login - give it more time (cold start)
          if (isNetworkError) {
            console.warn("[Auth] Network error on initial login - retrying with longer delay (cold start)...", {
              code: e?.code,
              message: e?.message,
            });

            // Wait longer for potential cold start
            await sleep(3000);

            try {
              const me = await fetchMe();
              setUserDoc(me);
              setNeedsOnboarding(false);
              return;
            } catch (retryErr: any) {
              const retryIsNetworkError = !retryErr?.response || retryErr?.code === 'ERR_NETWORK' || retryErr?.code === 'ETIMEDOUT' || retryErr?.code === 'ECONNABORTED';

              if (retryIsNetworkError) {
                console.error("[Auth] Network error persists after cold start delay. Keeping session but showing error.", {
                  code: retryErr?.code,
                  message: retryErr?.message,
                });
                // Don't logout - keep the session and let user retry manually
                setUserDoc(null);
                setNeedsOnboarding(false);
                return;
              }
            }
          }

          // 401: token timing issue -> retry with token refresh
          if (status === 401) {
            console.log("[Auth] Token invalid (401) - refreshing token and retrying...");

            try {
              // Force token refresh
              await u.getIdToken(true);
              await sleep(500);

              const me = await fetchMe();
              setUserDoc(me);
              setNeedsOnboarding(false);
              return;
            } catch (retryErr: any) {
              // After token refresh retry, if still 401, logout
              if (retryErr?.response?.status === 401) {
                console.error("[Auth] Token invalid after refresh. Logging out...");
                await auth.signOut();
                setUserDoc(null);
                setNeedsOnboarding(false);
                return;
              }
            }
          }

          // ✅ IMPORTANT: NO BOOTSTRAP ON LOGIN
          // If profile/org missing, just flag onboarding.
          if (
            status === 403 ||
            (status === 409 && code === "not_initialized")
          ) {
            setUserDoc(null);
            setNeedsOnboarding(true);
            return;
          }

          // Other errors - log but don't logout (could be temporary backend issue)
          console.error("[Auth] /api/me failed:", e);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => off();
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      userDoc,
      loading,
      needsOnboarding,
      logout,
      refreshUserDoc,
    }),
    [user, userDoc, loading, needsOnboarding]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
