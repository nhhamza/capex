import { useAuth } from "@/auth/authContext";
import { Navigate } from "react-router-dom";
import { CircularProgress, Box } from "@mui/material";
import { HomePage } from "@/pages/HomePage";

/**
 * Root route component that:
 * - Shows HomePage if user is not authenticated
 * - Redirects to /dashboard if user is authenticated
 */
export function RootRoute() {
  const { userDoc, loading } = useAuth();

  if (loading) {
    return (
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
  }

  // If authenticated, redirect to dashboard
  if (userDoc?.uid) {
    return <Navigate to="/dashboard" replace />;
  }

  // If not authenticated, show landing page
  return <HomePage />;
}
