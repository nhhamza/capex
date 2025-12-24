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

export type UserDoc =
  | {
      id?: string;
      email?: string | null;
      orgId?: string;
      organizationId?: string;
      role?: string;
      [k: string]: any;
    }
  | null;

type AuthCtx = {
  user: User | null;
  userDoc: UserDoc;
  loading: boolean;

  /**
   * True when the backend indicates the user profile/org is not initialized.
   * IMPORTANT: we do NOT auto-create anything on login.
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
    const r = await backendApi.get("/api/me");
    return (r.data?.user ?? null) as UserDoc;
  };

  const refreshUserDoc = async () => {
    if (!auth.currentUser) return;

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

      console.error(
        "[Auth] refreshUserDoc failed:",
        status,
        e?.response?.data || e
      );
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
      setUserDoc(null);
      setNeedsOnboarding(false);

      if (!u) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        // First attempt
        try {
          const me = await fetchMe();
          setUserDoc(me);
          setNeedsOnboarding(false);
          return;
        } catch (e: any) {
          const status = e?.response?.status;
          const code = e?.response?.data?.error;

          // Token timing issue after login (common on cold starts)
          if (status === 401) {
            for (const delay of [250, 750, 1250]) {
              await sleep(delay);
              try {
                const me = await fetchMe();
                setUserDoc(me);
                setNeedsOnboarding(false);
                return;
              } catch {}
            }
          }

          // IMPORTANT: never bootstrap here. Only flag onboarding.
          if (status === 403 || (status === 409 && code === "not_initialized")) {
            setUserDoc(null);
            setNeedsOnboarding(true);
            return;
          }

          console.error(
            "[Auth] /api/me failed:",
            status,
            e?.response?.data || e
          );
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
