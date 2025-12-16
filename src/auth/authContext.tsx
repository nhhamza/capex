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
  logout: () => Promise<void>;
  refreshUserDoc: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  userDoc: null,
  loading: true,
  logout: async () => {},
  refreshUserDoc: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userDoc, setUserDoc] = useState<UserDoc>(null);
  const [loading, setLoading] = useState(true);

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
        } catch (e: any) {
          const status = e?.response?.status;
          if (status === 403) {
            await backendApi.post("/api/bootstrap", { orgName: "Mi organización" });
            const me = await backendApi.get("/api/me");
            setUserDoc(me.data.user || null);
          } else {
            throw e;
          }
        }
      } catch (err) {
        console.error("[Auth] Error fetching user doc:", err);
        setUserDoc(null);
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
    () => ({ user, userDoc, loading, logout, refreshUserDoc }),
    [user, userDoc, loading]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
