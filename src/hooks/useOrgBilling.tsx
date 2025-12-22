import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { backendApi } from "@/lib/backendApi";
import { useAuth } from "@/auth/authContext";

interface OrgBillingData {
  plan: string;
  status: string | null;
  propertyLimit: number;
  seatLimit: number;
  graceUntil?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

interface OrgBillingContextValue {
  billing: OrgBillingData | null;
  loading: boolean;
  isGrace: boolean;
  isBlocked: boolean;
  refresh: () => void;
  // Backwards compatibility aliases
  plan: string;
  propertyLimit: number;
  seatLimit: number;
}

const OrgBillingContext = createContext<OrgBillingContextValue | undefined>(undefined);

export function OrgBillingProvider({ children }: { children: ReactNode }) {
  const { userDoc } = useAuth();
  const orgId = userDoc?.orgId || userDoc?.organizationId;

  const [billing, setBilling] = useState<OrgBillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = () => {
    console.log("🔄 Refreshing org billing data...");
    setRefreshTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    let alive = true;

    async function loadBilling() {
      if (!orgId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await backendApi.get("/api/org/limits");
        if (!alive) return;

        const data = response.data as any;

        // Derive limits from plan if not explicitly set
        const plan = data.plan ?? "free";
        const derivedPropertyLimit =
          typeof data.propertyLimit === "number"
            ? data.propertyLimit
            : plan === "solo"
            ? 10
            : plan === "pro"
            ? 50
            : plan === "agency"
            ? 200
            : 2;

        const derivedSeatLimit =
          typeof data.seatLimit === "number"
            ? data.seatLimit
            : plan === "solo"
            ? 1
            : plan === "pro"
            ? 3
            : plan === "agency"
            ? 10
            : 1;

        setBilling({
          plan,
          status: data.status ?? null,
          propertyLimit: derivedPropertyLimit,
          seatLimit: derivedSeatLimit,
          graceUntil: data.graceUntil,
          stripeCustomerId: data.stripeCustomerId,
          stripeSubscriptionId: data.stripeSubscriptionId,
        });

        console.log("✅ Org billing data loaded:", {
          plan,
          propertyLimit: derivedPropertyLimit,
          seatLimit: derivedSeatLimit,
        });
      } catch (err) {
        console.error("[OrgBillingProvider] failed to load billing", err);
        if (alive) {
          setBilling(null);
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    loadBilling();

    return () => {
      alive = false;
    };
  }, [orgId, refreshTrigger]);

  const isGrace = (() => {
    if (!billing) return false;
    const status = billing.status;
    const graceUntil = billing.graceUntil;
    if ((status === "past_due" || status === "unpaid") && graceUntil) {
      const now = new Date().toISOString();
      return now <= graceUntil;
    }
    return false;
  })();

  const isBlocked = (() => {
    if (!billing) return false;
    const status = billing.status;
    const graceUntil = billing.graceUntil;

    if (status === "canceled") return true;

    if ((status === "past_due" || status === "unpaid") && graceUntil) {
      const now = new Date().toISOString();
      return now > graceUntil;
    }

    return false;
  })();

  const value: OrgBillingContextValue = {
    billing,
    loading,
    isGrace,
    isBlocked,
    refresh,
    // Backwards compatibility aliases
    plan: billing?.plan ?? "free",
    propertyLimit: billing?.propertyLimit ?? 2,
    seatLimit: billing?.seatLimit ?? 1,
  };

  return (
    <OrgBillingContext.Provider value={value}>
      {children}
    </OrgBillingContext.Provider>
  );
}

/**
 * Unified hook that replaces useBillingStatus, useOrgPlan, and useOrgLimits
 * Single API call to /api/org/limits, shared across all components
 */
export function useOrgBilling() {
  const context = useContext(OrgBillingContext);
  if (context === undefined) {
    throw new Error("useOrgBilling must be used within OrgBillingProvider");
  }
  return context;
}
