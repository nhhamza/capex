import { useState } from "react";
import { Box, Typography, Button, Paper, Alert } from "@mui/material";
import { backendApi } from "@/lib/backendApi";

interface BlockedPayload {
  error: string;
  status: string;
  reason: string;
  graceUntil?: string;
  message: string;
}

export function BlockedPage() {
  const [loading, setLoading] = useState(false);

  const payload: BlockedPayload | null = (() => {
    try {
      const stored = sessionStorage.getItem("billing_blocked_payload");
      if (!stored) return null;
      return JSON.parse(stored) as BlockedPayload;
    } catch {
      return null;
    }
  })();

  const handleUpdatePayment = async () => {
    setLoading(true);
    try {
      const response = await backendApi.post("/api/billing/portal", {
        returnUrl: window.location.origin,
      });
      const { url } = response.data;
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Failed to open billing portal:", error);
      alert("Failed to open billing portal. Please try again.");
      setLoading(false);
    }
  };

  const formatDate = (isoDate: string | undefined) => {
    if (!isoDate) return "";
    try {
      return new Date(isoDate).toLocaleDateString();
    } catch {
      return isoDate;
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          maxWidth: 600,
          width: "100%",
          p: 4,
          textAlign: "center",
        }}
      >
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, color: "error.main" }}>
          Acceso Bloqueado
        </Typography>

        <Typography variant="body1" sx={{ mb: 3, color: "text.secondary" }}>
          {payload?.message || "Tu suscripción tiene un problema que requiere atención."}
        </Typography>

        {payload?.reason && (
          <Alert severity="error" sx={{ mb: 3, textAlign: "left" }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Motivo:
            </Typography>
            <Typography variant="body2">{payload.reason}</Typography>
            {payload.status && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Estado: <strong>{payload.status}</strong>
              </Typography>
            )}
            {payload.graceUntil && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Período de gracia expiró: <strong>{formatDate(payload.graceUntil)}</strong>
              </Typography>
            )}
          </Alert>
        )}

        <Typography variant="body2" sx={{ mb: 3 }}>
          Para restaurar el acceso, actualiza tu método de pago o contacta con soporte.
        </Typography>

        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleUpdatePayment}
          disabled={loading}
          fullWidth
        >
          {loading ? "Abriendo portal de facturación..." : "Actualizar método de pago"}
        </Button>

        <Button
          variant="text"
          color="secondary"
          size="small"
          href="mailto:support@example.com"
          sx={{ mt: 2 }}
        >
          Contactar soporte
        </Button>
      </Paper>
    </Box>
  );
}
