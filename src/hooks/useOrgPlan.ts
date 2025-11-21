import { useEffect, useState } from "react";
import { db } from "@/firebase/client";
import { doc, getDoc } from "firebase/firestore/lite";

/** Reads org document and returns plan + status.
 * Shape assumed: orgs/{orgId} => { plan: "free"|"solo"|"pro"|"agency", status?: string }
 */
export function useOrgPlan(orgId?: string) {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!orgId) {
        setPlan(null);
        setStatus(null);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "orgs", orgId));
        if (!alive) return;
        const data = snap.exists() ? (snap.data() as any) : {};
        setPlan(data.plan ?? "free");
        setStatus(data.status ?? null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [orgId]);

  return { loading, plan, status };
}
