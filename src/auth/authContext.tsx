import React, {
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

  const fetchMe = async (): Promise<UserDoc> => {
    const me = await backendApi.get("/api/me");
    return (me.data?.user ?? null) as UserDoc;
  };

  const refreshUserDoc = async () => {
    if (!user) return;

    try {
      const me = await fetchMe();
      setUserDoc(me);
      setNeedsOnboarding(false);
    } catch (e: any) {
      const status = e?.response?.status;
      const code = e?.response?.data?.error;

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
        // 1) Try normal /api/me
        try {
          const me = await fetchMe();
          setUserDoc(me);
          setNeedsOnboarding(false);
          return;
        } catch (e: any) {
          const status = e?.response?.status;
          const code = e?.response?.data?.error;

          // 401: token timing issue -> retry a couple times
          if (status === 401) {
            for (const delay of [300, 800]) {
              await sleep(delay);
              try {
                const me = await fetchMe();
                setUserDoc(me);
                setNeedsOnboarding(false);
                return;
              } catch {}
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
