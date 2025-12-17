import { useEffect, useState } from "react";
import { backendApi } from "@/lib/backendApi";
import { useAuth } from "@/auth/authContext";

interface BillingData {
  plan: string;
  status: string;
  propertyLimit: number;
  seatLimit: number;
  graceUntil?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

interface UseBillingStatusReturn {
  billing: BillingData | null;
  loading: boolean;
  isGrace: boolean;
  isBlocked: boolean;
  reload: () => void;
}

export function useBillingStatus(): UseBillingStatusReturn {
  const { userDoc } = useAuth();
  const orgId = userDoc?.orgId || userDoc?.organizationId;

  const [billing, setBilling] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const reload = () => {
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

        const data = response.data as BillingData;
        setBilling(data);
      } catch (err) {
        console.error("[useBillingStatus] failed to load billing", err);
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

  return { billing, loading, isGrace, isBlocked, reload };
}
