import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { useAuth } from "@/auth/authContext";
import { useOrgLimits } from "@/hooks/useOrgLimits";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export function BillingSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { userDoc } = useAuth();
  const { refresh: refreshOrgLimits } = useOrgLimits(userDoc?.orgId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedPlan, setUpdatedPlan] = useState<string | null>(null);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    console.log("🎯 BillingSuccessPage mounted");
    console.log("📍 Session ID from URL:", sessionId);
    console.log("📍 API URL:", API_URL);
    console.log("📍 User orgId:", userDoc?.orgId);

    if (!sessionId) {
      console.warn("⚠️ No session_id in URL");
      setLoading(false);
      return;
    }

    let isCancelled = false;

    // Check the session once
    const checkSession = async () => {
      try {
        console.log("🔍 Checking session:", sessionId);
        const url = `${API_URL}/check-session/${sessionId}`;
        console.log("📡 Fetching:", url);

        const response = await fetch(url);
        console.log("📥 Response status:", response.status);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("📦 Session check response:", data);

        if (isCancelled) return;

        if (data.paid) {
          console.log("✅ Payment confirmed, plan updated to:", data.plan);
          setUpdatedPlan(data.plan);
          // Refresh org limits to get updated plan
          console.log("🔄 Triggering org limits refresh...");
          refreshOrgLimits();
          setLoading(false);

          // Navigate to billing page after 3 seconds to show updated plan
          setTimeout(() => {
            console.log("📍 Navigating to billing page...");
            navigate("/billing", { replace: true });
          }, 3000);
        } else if (data.error) {
          console.error("❌ Server returned error:", data.error);
          setError(data.error);
          setLoading(false);
        } else {
          // Payment not yet processed, check again
          console.log("⏳ Payment not confirmed yet, checking again in 2s...");
          setTimeout(checkSession, 2000);
        }
      } catch (err: any) {
        console.error("❌ Error checking session:", err);
        if (!isCancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    checkSession();

    return () => {
      isCancelled = true;
    };
  }, [sessionId, API_URL, userDoc?.orgId]); // Removed refreshOrgLimits from dependencies to prevent infinite loop

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 2,
        }}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="text.secondary">
          Procesando tu pago...
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Por favor espera mientras confirmamos tu suscripción
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 600, mx: "auto", mt: 4 }}>
        <Alert severity="error">Error al verificar el pago: {error}</Alert>
        <Button onClick={() => navigate("/billing")} sx={{ mt: 2 }}>
          Volver a Facturación
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "60vh",
      }}
    >
      <Paper
        sx={{
          p: 4,
          maxWidth: 500,
          textAlign: "center",
        }}
      >
        <CheckCircleOutlineIcon
          sx={{ fontSize: 80, color: "success.main", mb: 2 }}
        />
        <Typography variant="h4" gutterBottom>
          ¡Pago Exitoso!
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Tu suscripción ha sido activada correctamente. Ahora puedes disfrutar
          de todas las funciones de tu nuevo plan.
        </Typography>

        {updatedPlan && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Plan actualizado a: <strong>{updatedPlan.toUpperCase()}</strong>
          </Alert>
        )}

        {sessionId && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mb: 3, display: "block" }}
          >
            ID de sesión: {sessionId}
          </Typography>
        )}

        <Box sx={{ display: "flex", gap: 2, justifyContent: "center", mt: 3 }}>
          <Button
            variant="contained"
            onClick={() => navigate("/dashboard")}
            size="large"
          >
            Ir al Dashboard
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate("/billing")}
            size="large"
          >
            Ver mi Plan
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
