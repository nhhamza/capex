// guards.tsx
import { Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "./authContext";
import { useOrgLimits } from "@/hooks/useOrgLimits";

const FULL_PAGE_LOADER = (
  <Box
    sx={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      minHeight: "100vh",
    }}
  >
    <CircularProgress />
  </Box>
);

// ✅ If your billing route is nested (e.g. "/app/billing"), change this:
const BILLING_PATH = "/billing";

// stable object identity (prevents repeated navigations due to new object each render)
const BLOCKED_STATE = { blocked: true } as const;

function isPathOrChild(pathname: string, basePath: string) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return FULL_PAGE_LOADER;

  if (!user) {
    // keep where the user wanted to go (optional but handy)
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

export function RequireOrg({ children }: { children: JSX.Element }) {
  const { userDoc, loading } = useAuth();
  const location = useLocation();

  if (loading) return FULL_PAGE_LOADER;

  if (!userDoc?.orgId && !userDoc?.organizationId) {
    return <Navigate to="/setup-org" replace state={{ from: location }} />;
  }

  return children;
}

/**
 * Blocks the app when a paid subscription is not in good standing.
 * - Free plan always allowed.
 * - Paid plans must be `active` or `trialing`.
 * - Billing page is always accessible.
 *
 * IMPORTANT: Set BILLING_PATH to your *real* route to avoid redirect loops.
 */
export function RequireBilling({ children }: { children: JSX.Element }) {
  const { userDoc } = useAuth();
  const location = useLocation();

  const orgId = userDoc?.orgId || userDoc?.organizationId;

  // If org not ready yet, let RequireOrg handle it.
  if (!orgId) return children;

  const { loading, plan, status } = useOrgLimits(orgId);

  const onBilling = isPathOrChild(location.pathname, BILLING_PATH);

  const isPaidPlan = Boolean(plan && plan !== "free");
  const isGoodStanding =
    !isPaidPlan || status === "active" || status === "trialing";

  const isBillingRoute =
    location.pathname === "/billing" ||
    location.pathname.startsWith("/billing/") ||
    location.hash === "#/billing" ||
    location.hash.startsWith("#/billing/");
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Not in good standing: allow billing route, block everything else
  if (!isGoodStanding && !onBilling && !isBillingRoute) {
    return <Navigate to={BILLING_PATH} replace state={BLOCKED_STATE} />;
  }

  return children;
}
