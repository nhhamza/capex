import { useEffect, useState } from "react";
import { backendApi } from "@/lib/backendApi";

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
        const r = await backendApi.get("/api/org/limits");
        if (!alive) return;
        const data = (r.data || {}) as any;
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
