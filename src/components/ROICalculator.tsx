import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import EuroIcon from "@mui/icons-material/Euro";
import { useNavigate } from "react-router-dom";

export function ROICalculator() {
  const navigate = useNavigate();

  // Estado para los inputs
  const [purchasePrice, setPurchasePrice] = useState(150000);
  const [monthlyRent, setMonthlyRent] = useState(750);
  const [monthlyExpenses, setMonthlyExpenses] = useState(200);
  const [downPayment, setDownPayment] = useState(30000);

  // Cálculos automáticos
  const annualCashflow = (monthlyRent - monthlyExpenses) * 12;
  const cashOnCashReturn =
    downPayment > 0 ? (annualCashflow / downPayment) * 100 : 0;

  // Determinar severidad según ROI
  let severity: "success" | "warning" | "error" = "error";
  let message = "";

  if (cashOnCashReturn > 6) {
    severity = "success";
    message = "¡Excelente! Supera el objetivo del 6% anual";
  } else if (cashOnCashReturn >= 3) {
    severity = "warning";
    message = "Rentabilidad moderada. Podrías optimizar gastos";
  } else {
    severity = "error";
    message = "Rentabilidad baja. Revisa tus números";
  }

  const handleNavigateToSignup = () => {
    navigate("/signup");
  };

  return (
    <Card
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        boxShadow: "none",
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          🧮 ¿Es rentable tu inversión?
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Calcula el ROI de tu propiedad en segundos
        </Typography>

        {/* Grid de inputs */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Precio de compra"
              type="number"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(Number(e.target.value))}
              InputProps={{
                endAdornment: <EuroIcon sx={{ opacity: 0.5, ml: 1 }} />,
              }}
              size="small"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Alquiler mensual"
              type="number"
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(Number(e.target.value))}
              InputProps={{
                endAdornment: <EuroIcon sx={{ opacity: 0.5, ml: 1 }} />,
              }}
              size="small"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Gastos mensuales estimados"
              type="number"
              value={monthlyExpenses}
              onChange={(e) => setMonthlyExpenses(Number(e.target.value))}
              InputProps={{
                endAdornment: <EuroIcon sx={{ opacity: 0.5, ml: 1 }} />,
              }}
              size="small"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Entrada inicial / Down payment"
              type="number"
              value={downPayment}
              onChange={(e) => setDownPayment(Number(e.target.value))}
              InputProps={{
                endAdornment: <EuroIcon sx={{ opacity: 0.5, ml: 1 }} />,
              }}
              size="small"
            />
          </Grid>
        </Grid>

        {/* Resultados */}
        <Box sx={{ mb: 3 }}>
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Cashflow anual:
              </Typography>
              <Typography variant="body2" fontWeight={700}>
                {annualCashflow > 0 ? "+" : ""}€
                {annualCashflow.toLocaleString("es-ES")}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Cash-on-Cash Return:
              </Typography>
              <Typography
                variant="body2"
                fontWeight={700}
                color={
                  severity === "success"
                    ? "success.main"
                    : severity === "warning"
                      ? "warning.main"
                      : "error.main"
                }
              >
                {cashOnCashReturn.toFixed(2)}%
              </Typography>
            </Box>
          </Stack>

          {/* Alert de ROI */}
          <Alert severity={severity} sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight={700}>
              {message}
            </Typography>
          </Alert>
        </Box>

        {/* Botón CTA */}
        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleNavigateToSignup}
          sx={{
            textTransform: "none",
            fontWeight: 700,
          }}
        >
          Calcular para todas mis propiedades
        </Button>
      </CardContent>
    </Card>
  );
}
