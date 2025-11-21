import { useEffect, useState } from "react";
import { db } from "@/firebase/client";
import { doc, getDoc } from "firebase/firestore/lite";

interface OrgLimitsState {
  loading: boolean;
  plan: string;
  status: string | null;
  propertyLimit: number;
  seatLimit: number;
  refresh: () => void;
}

export function useOrgLimits(orgId?: string): OrgLimitsState {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState("free");
  const [status, setStatus] = useState<string | null>(null);
  const [propertyLimit, setPropertyLimit] = useState<number>(2);
  const [seatLimit, setSeatLimit] = useState<number>(1);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refresh = () => {
    console.log("🔄 Refreshing org limits...");
    setRefreshTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!orgId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "orgs", orgId));
        const data = snap.exists() ? (snap.data() as any) : {};
        if (!alive) return;
        const p = data.plan ?? "free";
        setPlan(p);
        setStatus(data.status ?? null);
        // Use stored limits if present, else derive from plan
        const derivedPropertyLimit =
          typeof data.propertyLimit === "number"
            ? data.propertyLimit
            : p === "solo"
            ? 10
            : p === "pro"
            ? 50
            : p === "agency"
            ? 200
            : 2;
        const derivedSeatLimit =
          typeof data.seatLimit === "number"
            ? data.seatLimit
            : p === "solo"
            ? 1
            : p === "pro"
            ? 3
            : p === "agency"
            ? 10
            : 1;
        setPropertyLimit(derivedPropertyLimit);
        setSeatLimit(derivedSeatLimit);
        console.log("✅ Org limits loaded:", {
          plan: p,
          propertyLimit: derivedPropertyLimit,
          seatLimit: derivedSeatLimit,
        });
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [orgId, refreshTrigger]);

  return { loading, plan, status, propertyLimit, seatLimit, refresh };
}
