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

type UserDoc =
  | {
      email: string | null;
      orgId?: string;
      organizationId?: string;
      role: "owner" | "member" | "admin";
      createdAt?: string;
      updatedAt?: string;
    }
  | null;

type AuthCtx = {
  user: User | null;
  userDoc: UserDoc;
  loading: boolean;
  needsOnboarding: boolean;
  logout: () => Promise<void>;
  refreshUserDoc: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  userDoc: null,
  loading: true,
  needsOnboarding: false,
  logout: async () => {},
  refreshUserDoc: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    const off = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setUserDoc(null);
        setLoading(false);
        return;
      }
      try {
        // Load profile from backend. If profile is missing (first signup), bootstrap then retry.
        try {
          const me = await backendApi.get("/api/me");
          setUserDoc(me.data.user || null);
          setNeedsOnboarding(false);
        } catch (e: any) {
          const status = e?.response?.status;
          const errorMsg = e?.response?.data?.error || e?.message || "";

          if (status === 401) {
            // 401: Auth token issue (Missing/Invalid Bearer token)
            // This is a temporary auth problem, don't clear userDoc
            // Wait a bit and retry once
            console.warn("[Auth] 401 error, retrying after delay:", errorMsg);
            await new Promise((resolve) => setTimeout(resolve, 500));
            try {
              const me = await backendApi.get("/api/me");
              setUserDoc(me.data.user || null);
            } catch (retryErr: any) {
              console.error("[Auth] Retry failed, but keeping existing userDoc:", retryErr);
              // CRITICAL: Never clear userDoc on errors
              // User data is too valuable to lose
              // If there's a real auth issue, user can logout/login manually
            }
          } else if (status === 403) {
            // 403: Profile/org missing. DO NOT auto-bootstrap here (can fork users into a new org).
            console.warn("[Auth] User profile/org missing (403). Redirect user to signup/onboarding instead of auto-creating.");
            setNeedsOnboarding(true);
            setUserDoc(null);
          } else {
            // Other errors - log but DON'T clear userDoc
            console.error("[Auth] Error loading profile, but preserving userDoc:", e);
            // CRITICAL: Never clear userDoc on errors
            // Admin will handle account issues manually
          }
        }
      } catch (err: any) {
        console.error("[Auth] Error fetching user doc:", err);
        // CRITICAL: Never clear userDoc on errors to prevent data loss
        // If user needs to be removed, admin will do it manually
        console.warn("[Auth] Preserving userDoc despite errors - admin handles account removal manually");
      } finally {
        setLoading(false);
      }
    });
    return off;
  }, []);

  async function logout() {
    try {
      await auth.signOut();
    } catch (err) {
      console.error("[Auth] logout failed", err);
    }
  }

  async function refreshUserDoc() {
    if (!user) return;
    try {
      const me = await backendApi.get("/api/me");
      setUserDoc(me.data.user || null);
      console.log("✅ User doc refreshed");
    } catch (err) {
      console.error("[Auth] Error refreshing user doc:", err);
    }
  }

  const value = useMemo(
    () => ({ user, userDoc, loading, needsOnboarding, logout, refreshUserDoc }),
    [user, userDoc, loading, needsOnboarding]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
