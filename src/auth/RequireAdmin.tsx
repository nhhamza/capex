import { Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "./authContext";

export function RequireAdmin({ children }: { children: JSX.Element }) {
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

  if (userDoc?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
