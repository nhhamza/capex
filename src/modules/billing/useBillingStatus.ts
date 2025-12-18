import { useCallback, useEffect, useMemo, useState } from "react";
import { backendApi } from "@/lib/backendApi";

type BillingDoc = {
  plan?: string;
  status?: "active" | "trialing" | "past_due" | "unpaid" | "canceled" | string;
  graceUntil?: string | null;
  priceId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  propertyLimit?: number;
  seatLimit?: number;
};

function isIsoInFuture(iso?: string | null) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t > Date.now();
}

export function useBillingStatus() {
  const [billing, setBilling] = useState<BillingDoc | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await backendApi.get("/api/org/limits");
      setBilling(data || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const status = billing?.status || "active";
  const graceUntil = billing?.graceUntil ?? null;

  const isGrace = useMemo(() => {
    return (
      (status === "past_due" || status === "unpaid") &&
      isIsoInFuture(graceUntil)
    );
  }, [status, graceUntil]);

  const isBlocked = useMemo(() => {
    if (status === "canceled") return true;
    if (status === "past_due" || status === "unpaid") {
      // blocked if grace missing or expired
      return !isIsoInFuture(graceUntil);
    }
    // active/trialing => not blocked
    if (status === "active" || status === "trialing") return false;
    // unknown => block safe-by-default
    return true;
  }, [status, graceUntil]);

  return { billing, loading, isGrace, isBlocked, reload };
}
