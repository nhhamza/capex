import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
} from "@mui/material";
import { backendApi } from "@/lib/backendApi";
import { useNavigate, useLocation } from "react-router-dom";

type BlockPayload = {
  error?: string;
  status?: string;
  reason?: string;
  graceUntil?: string | null;
  message?: string;
};

function formatDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export function BlockedPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [payload, setPayload] = useState<BlockPayload | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("billing_blocked_payload");
    if (raw) {
      try {
        setPayload(JSON.parse(raw));
      } catch {
        setPayload(null);
      }
    }
  }, []);

  const graceText = useMemo(() => {
    const graceUntil = payload?.graceUntil ?? null;
    if (!graceUntil) return null;
    return `Gracia hasta: ${formatDate(graceUntil)}`;
  }, [payload?.graceUntil]);

  const openPortal = async () => {
    setLoadingPortal(true);
    setError(null);
    try {
      const returnUrl = window.location.origin + "/billing";
      const { data } = await backendApi.post("/api/billing/portal", {
        returnUrl,
      });
      if (!data?.url) throw new Error("Missing portal url");
      window.location.assign(data.url);
    } catch (e: any) {
      setError(
        e?.response?.data?.error || e.message || "Failed to open billing portal"
      );
      setLoadingPortal(false);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "70vh",
        px: 2,
      }}
    >
      <Paper sx={{ p: 4, maxWidth: 720, width: "100%" }}>
        <Typography variant="h4" gutterBottom>
          Acceso bloqueado por facturación
        </Typography>

        <Typography variant="body1" color="text.secondary" paragraph>
          Tu suscripción no está al día. Para seguir usando la app, actualiza tu
          método de pago en Stripe.
        </Typography>

        {payload?.reason && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {payload.reason}
          </Alert>
        )}
        {graceText && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {graceText}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mt: 2 }}>
          <Button
            variant="contained"
            onClick={openPortal}
            disabled={loadingPortal}
          >
            {loadingPortal ? <CircularProgress size={22} /> : "Actualizar pago"}
          </Button>

          <Button
            variant="outlined"
            onClick={() => navigate("/billing", { state: { blocked: true } })}
          >
            Ver planes
          </Button>

          <Button
            variant="text"
            onClick={() => {
              const from = (location.state as any)?.from;
              navigate(from || "/dashboard");
            }}
          >
            Volver
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
