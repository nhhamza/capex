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
import { backendApi } from "@/lib/backendApi";

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
    if (!sessionId) {
      setLoading(false);
      setError("Missing session_id");
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const { data } = await backendApi.get(`/check-session/${sessionId}`);

        if (cancelled) return;

        if (data?.paid) {
          setUpdatedPlan(data.plan || null);
          refreshOrgLimits();
          setLoading(false);

          setTimeout(() => {
            navigate("/billing", { replace: true });
          }, 1500);
          return;
        }

        // Not paid yet => poll again
        setTimeout(poll, 1500);
      } catch (e: any) {
        if (cancelled) return;
        setError(
          e?.response?.data?.error || e.message || "Failed to verify payment"
        );
        setLoading(false);
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate, refreshOrgLimits]);

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
      <Paper sx={{ p: 4, maxWidth: 500, textAlign: "center" }}>
        <CheckCircleOutlineIcon
          sx={{ fontSize: 80, color: "success.main", mb: 2 }}
        />
        <Typography variant="h4" gutterBottom>
          ¡Pago Exitoso!
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Tu suscripción ha sido activada correctamente.
        </Typography>

        {updatedPlan && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Plan actualizado a: <strong>{updatedPlan.toUpperCase()}</strong>
          </Alert>
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
