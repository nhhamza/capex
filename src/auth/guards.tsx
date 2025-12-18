import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { CircularProgress, Box } from "@mui/material";
import { useAuth } from "@/auth/authContext";
import { backendApi } from "@/lib/backendApi";
import { useBillingStatus } from "@/billing/useBillingStatus";

/**
 * RequireAuth:
 * - user must be logged in
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}

/**
 * RequireOrg:
 * - user must have an orgId
 */
export function RequireOrg({ children }: { children: React.ReactNode }) {
  const { userDoc, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const orgId = userDoc?.organizationId || userDoc?.orgId;
  if (!orgId) {
    return (
      <Navigate to="/setup-org" state={{ from: location.pathname }} replace />
    );
  }

  return <>{children}</>;
}

/**
 * RequireBilling:
 * - allows access if billing is OK OR within grace period
 * - blocks only if canceled OR grace expired
 *
 * Important:
 * - We do NOT rely on catching API 403 here.
 * - We proactively read billing from /api/org/limits.
 */
export function RequireBilling({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { loading: authLoading } = useAuth();
  const { billing, loading, isGrace, isBlocked } = useBillingStatus();

  // while auth is loading, don't redirect
  if (authLoading || loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  // If blocked:
  // - redirect to /blocked
  // - keep original path in state so user can return after payment
  if (isBlocked) {
    // store reason if available for BlockedPage
    sessionStorage.setItem(
      "billing_blocked_payload",
      JSON.stringify({
        error: "billing_blocked",
        status: billing?.status,
        reason:
          billing?.status === "canceled"
            ? "Subscription canceled"
            : "Payment overdue",
        graceUntil: billing?.graceUntil || null,
      })
    );

    return (
      <Navigate
        to="/blocked"
        state={{ from: location.pathname, blocked: true }}
        replace
      />
    );
  }

  // Allowed OR within grace => access
  // isGrace is only used for UI banners etc (not blocking)
  return <>{children}</>;
}
