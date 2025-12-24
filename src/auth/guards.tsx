import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { CircularProgress, Box } from "@mui/material";
import { useAuth } from "@/auth/authContext";
import { useOrgBilling } from "@/hooks/useOrgBilling";

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
 * - user must have an initialized profile + orgId.
 * - IMPORTANT: we NEVER create org/profile here.
 *   Org/profile creation happens ONLY during SignUp via POST /api/signup/initialize.
 */
export function RequireOrg({ children }: { children: React.ReactNode }) {
  const { userDoc, loading, needsOnboarding } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (needsOnboarding) {
    return <Navigate to="/setup-org" state={{ from: location.pathname }} replace />;
  }

  const orgId = userDoc?.organizationId || userDoc?.orgId;

  // If orgId is missing but we are not explicitly in onboarding state, show a spinner
  // (this avoids accidental redirects due to transient loading or backend errors).
  if (!orgId) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return <>{children}</>;
}

/**
 * RequireBilling:
 * - user must have active subscription to access billing-protected routes
 */
export function RequireBilling({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();
  const { isLoading, hasActiveSubscription } = useOrgBilling();
  const location = useLocation();

  if (loading || isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!hasActiveSubscription) {
    return <Navigate to="/billing" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}
