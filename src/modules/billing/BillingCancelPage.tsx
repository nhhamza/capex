import { useNavigate } from "react-router-dom";
import { Box, Paper, Typography, Button } from "@mui/material";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";

export function BillingCancelPage() {
  const navigate = useNavigate();

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
        <CancelOutlinedIcon
          sx={{ fontSize: 80, color: "warning.main", mb: 2 }}
        />
        <Typography variant="h4" gutterBottom>
          Pago Cancelado
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Has cancelado el proceso de pago. No se ha realizado ningún cargo a tu
          tarjeta.
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Si tuviste algún problema durante el proceso de pago, por favor
          contáctanos para ayudarte.
        </Typography>

        <Box sx={{ display: "flex", gap: 2, justifyContent: "center", mt: 3 }}>
          <Button
            variant="contained"
            onClick={() => navigate("/billing")}
            size="large"
          >
            Ver Planes
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate("/dashboard")}
            size="large"
          >
            Volver al Dashboard
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
