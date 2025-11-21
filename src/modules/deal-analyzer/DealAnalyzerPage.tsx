import { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Grid,
  Button,
  Card,
  CardContent,
  Divider,
  Alert,
  Stack,
  InputAdornment,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import CalculateIcon from "@mui/icons-material/Calculate";

interface DealInputs {
  purchasePrice: number;
  downPaymentPercent: number;
  interestRate: number;
  loanTerm: number;
  closingCosts: number;
  renovationCosts: number;
  monthlyRent: number;
  propertyTax: number;
  insurance: number;
  hoa: number;
  maintenance: number;
  propertyManagement: number;
  utilities: number;
}

interface DealResults {
  totalInvestment: number;
  downPayment: number;
  loanAmount: number;
  monthlyMortgage: number;
  grossMonthlyIncome: number;
  effectiveMonthlyIncome: number;
  totalMonthlyExpenses: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  capRate: number;
  cashOnCash: number;
  dscr: number;
  breakEven: number;
  isProfitable: boolean;
}

export function DealAnalyzerPage() {
  const [inputs, setInputs] = useState<DealInputs>({
    purchasePrice: 200000,
    downPaymentPercent: 20,
    interestRate: 3.5,
    loanTerm: 30,
    closingCosts: 5000,
    renovationCosts: 0,
    monthlyRent: 1500,
    propertyTax: 1200,
    insurance: 100,
    hoa: 0,
    maintenance: 150,
    propertyManagement: 10,
    utilities: 0,
  });

  const [results, setResults] = useState<DealResults | null>(null);

  const calculateDeal = () => {
    const downPayment =
      inputs.purchasePrice * (inputs.downPaymentPercent / 100);
    const loanAmount = inputs.purchasePrice - downPayment;
    const totalInvestment =
      downPayment + inputs.closingCosts + inputs.renovationCosts;

    // Monthly mortgage payment (P&I)
    const monthlyRate = inputs.interestRate / 100 / 12;
    const numPayments = inputs.loanTerm * 12;
    const monthlyMortgage =
      loanAmount > 0
        ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
          (Math.pow(1 + monthlyRate, numPayments) - 1)
        : 0;

    // Income
    const grossMonthlyIncome = inputs.monthlyRent;
    const effectiveMonthlyIncome = grossMonthlyIncome;

    // Expenses (convert annual IBI to monthly)
    const monthlyPropertyTax = inputs.propertyTax / 12;
    const propertyManagementFee =
      inputs.monthlyRent * (inputs.propertyManagement / 100);
    const totalMonthlyExpenses =
      monthlyMortgage +
      monthlyPropertyTax +
      inputs.insurance +
      inputs.hoa +
      inputs.maintenance +
      propertyManagementFee +
      inputs.utilities;

    // Cash flow
    const monthlyCashFlow = effectiveMonthlyIncome - totalMonthlyExpenses;
    const annualCashFlow = monthlyCashFlow * 12;

    // Metrics
    const annualIncome = effectiveMonthlyIncome * 12;
    const annualExpenses = totalMonthlyExpenses * 12 - monthlyMortgage * 12;
    const noi = annualIncome - annualExpenses;
    const capRate = (noi / inputs.purchasePrice) * 100;
    const cashOnCash =
      totalInvestment > 0 ? (annualCashFlow / totalInvestment) * 100 : 0;

    // DSCR (Debt Service Coverage Ratio)
    const annualDebtService = monthlyMortgage * 12;
    const dscr = annualDebtService > 0 ? noi / annualDebtService : 0;

    // Break-even occupancy
    const breakEven =
      grossMonthlyIncome > 0
        ? (totalMonthlyExpenses / grossMonthlyIncome) * 100
        : 0;

    const isProfitable = monthlyCashFlow > 0 && cashOnCash > 6;

    setResults({
      totalInvestment,
      downPayment,
      loanAmount,
      monthlyMortgage,
      grossMonthlyIncome,
      effectiveMonthlyIncome,
      totalMonthlyExpenses,
      monthlyCashFlow,
      annualCashFlow,
      capRate,
      cashOnCash,
      dscr,
      breakEven,
      isProfitable,
    });
  };

  const handleInputChange = (field: keyof DealInputs, value: string) => {
    setInputs((prev) => ({
      ...prev,
      [field]: parseFloat(value) || 0,
    }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Analizador de Inversiones
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Evalúa la rentabilidad de una propiedad antes de invertir
      </Typography>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Datos de la Propiedad
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Precio de Compra"
                  type="number"
                  value={inputs.purchasePrice}
                  onChange={(e) =>
                    handleInputChange("purchasePrice", e.target.value)
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">€</InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Entrada (%)"
                  type="number"
                  value={inputs.downPaymentPercent}
                  onChange={(e) =>
                    handleInputChange("downPaymentPercent", e.target.value)
                  }
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">%</InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Interés Anual (%)"
                  type="number"
                  value={inputs.interestRate}
                  onChange={(e) =>
                    handleInputChange("interestRate", e.target.value)
                  }
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">%</InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Plazo Hipoteca (años)"
                  type="number"
                  value={inputs.loanTerm}
                  onChange={(e) =>
                    handleInputChange("loanTerm", e.target.value)
                  }
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Gastos de Compra"
                  type="number"
                  value={inputs.closingCosts}
                  onChange={(e) =>
                    handleInputChange("closingCosts", e.target.value)
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">€</InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Reforma"
                  type="number"
                  value={inputs.renovationCosts}
                  onChange={(e) =>
                    handleInputChange("renovationCosts", e.target.value)
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">€</InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>

            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
              Ingresos
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Renta Mensual"
                  type="number"
                  value={inputs.monthlyRent}
                  onChange={(e) =>
                    handleInputChange("monthlyRent", e.target.value)
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">€</InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>

            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
              Gastos Anuales
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="IBI"
                  type="number"
                  value={inputs.propertyTax}
                  onChange={(e) =>
                    handleInputChange("propertyTax", e.target.value)
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">€</InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>

            <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
              Gastos Mensuales
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Seguro"
                  type="number"
                  value={inputs.insurance}
                  onChange={(e) =>
                    handleInputChange("insurance", e.target.value)
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">€</InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Comunidad"
                  type="number"
                  value={inputs.hoa}
                  onChange={(e) => handleInputChange("hoa", e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">€</InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Mantenimiento"
                  type="number"
                  value={inputs.maintenance}
                  onChange={(e) =>
                    handleInputChange("maintenance", e.target.value)
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">€</InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Gestión (%)"
                  type="number"
                  value={inputs.propertyManagement}
                  onChange={(e) =>
                    handleInputChange("propertyManagement", e.target.value)
                  }
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">%</InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Suministros"
                  type="number"
                  value={inputs.utilities}
                  onChange={(e) =>
                    handleInputChange("utilities", e.target.value)
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">€</InputAdornment>
                    ),
                  }}
                />
              </Grid>
            </Grid>

            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={calculateDeal}
              startIcon={<CalculateIcon />}
              sx={{ mt: 3 }}
            >
              Calcular Rentabilidad
            </Button>
          </Paper>
        </Grid>

        {/* Results Section */}
        <Grid item xs={12} lg={6}>
          {results ? (
            <Stack spacing={2}>
              {/* Verdict */}
              <Alert
                severity={results.isProfitable ? "success" : "warning"}
                icon={
                  results.isProfitable ? (
                    <TrendingUpIcon />
                  ) : (
                    <TrendingDownIcon />
                  )
                }
              >
                <Typography variant="h6">
                  {results.isProfitable
                    ? "✓ Inversión Rentable"
                    : "⚠ Inversión de Riesgo"}
                </Typography>
                <Typography variant="body2">
                  {results.isProfitable
                    ? "Esta propiedad cumple con los criterios de rentabilidad (Cash-on-Cash > 6%)"
                    : "Esta propiedad no alcanza los criterios mínimos de rentabilidad"}
                </Typography>
              </Alert>

              {/* Investment Summary */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Inversión Inicial
                  </Typography>
                  <Stack spacing={1}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <Typography color="text.secondary">Entrada</Typography>
                      <Typography fontWeight={600}>
                        {formatCurrency(results.downPayment)}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <Typography color="text.secondary">
                        Gastos + Reforma
                      </Typography>
                      <Typography fontWeight={600}>
                        {formatCurrency(
                          results.totalInvestment - results.downPayment
                        )}
                      </Typography>
                    </Box>
                    <Divider />
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <Typography fontWeight={700}>Total Inversión</Typography>
                      <Typography fontWeight={700} color="primary.main">
                        {formatCurrency(results.totalInvestment)}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              {/* Monthly Cash Flow */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Flujo de Caja Mensual
                  </Typography>
                  <Stack spacing={1}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <Typography color="text.secondary">
                        Ingreso Efectivo
                      </Typography>
                      <Typography>
                        {formatCurrency(results.effectiveMonthlyIncome)}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <Typography color="text.secondary">
                        Gastos Totales
                      </Typography>
                      <Typography>
                        -{formatCurrency(results.totalMonthlyExpenses)}
                      </Typography>
                    </Box>
                    <Divider />
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <Typography fontWeight={700}>Cash Flow</Typography>
                      <Typography
                        fontWeight={700}
                        color={
                          results.monthlyCashFlow > 0
                            ? "success.main"
                            : "error.main"
                        }
                      >
                        {formatCurrency(results.monthlyCashFlow)}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <Typography color="text.secondary">Anual</Typography>
                      <Typography fontWeight={600}>
                        {formatCurrency(results.annualCashFlow)}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              {/* Key Metrics */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Métricas Clave
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Box
                        sx={{
                          textAlign: "center",
                          p: 2,
                          bgcolor: "background.default",
                          borderRadius: 1,
                        }}
                      >
                        <Typography
                          variant="h4"
                          color={
                            results.cashOnCash > 8
                              ? "success.main"
                              : results.cashOnCash > 6
                              ? "warning.main"
                              : "error.main"
                          }
                        >
                          {formatPercent(results.cashOnCash)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Cash-on-Cash
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box
                        sx={{
                          textAlign: "center",
                          p: 2,
                          bgcolor: "background.default",
                          borderRadius: 1,
                        }}
                      >
                        <Typography
                          variant="h4"
                          color={
                            results.capRate > 6
                              ? "success.main"
                              : results.capRate > 4
                              ? "warning.main"
                              : "error.main"
                          }
                        >
                          {formatPercent(results.capRate)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Cap Rate
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box
                        sx={{
                          textAlign: "center",
                          p: 2,
                          bgcolor: "background.default",
                          borderRadius: 1,
                        }}
                      >
                        <Typography
                          variant="h4"
                          color={
                            results.dscr > 1.25
                              ? "success.main"
                              : results.dscr > 1
                              ? "warning.main"
                              : "error.main"
                          }
                        >
                          {results.dscr.toFixed(2)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          DSCR
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box
                        sx={{
                          textAlign: "center",
                          p: 2,
                          bgcolor: "background.default",
                          borderRadius: 1,
                        }}
                      >
                        <Typography
                          variant="h4"
                          color={
                            results.breakEven < 80
                              ? "success.main"
                              : results.breakEven < 90
                              ? "warning.main"
                              : "error.main"
                          }
                        >
                          {formatPercent(results.breakEven)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Break-Even
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Loan Details */}
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Detalles del Préstamo
                  </Typography>
                  <Stack spacing={1}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <Typography color="text.secondary">
                        Cantidad Prestada
                      </Typography>
                      <Typography fontWeight={600}>
                        {formatCurrency(results.loanAmount)}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <Typography color="text.secondary">
                        Pago Mensual (P&I)
                      </Typography>
                      <Typography fontWeight={600}>
                        {formatCurrency(results.monthlyMortgage)}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Paper sx={{ p: 2, bgcolor: "info.lighter" }}>
                <Typography variant="subtitle2" gutterBottom>
                  💡 Criterios de Inversión
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Cash-on-Cash: Mínimo 6%, Óptimo &gt; 8%
                  <br />
                  • Cap Rate: Mínimo 4%, Óptimo &gt; 6%
                  <br />
                  • DSCR: Mínimo 1.0, Óptimo &gt; 1.25
                  <br />• Break-Even: Máximo 90%, Óptimo &lt; 80%
                </Typography>
              </Paper>
            </Stack>
          ) : (
            <Paper sx={{ p: 4, textAlign: "center" }}>
              <CalculateIcon sx={{ fontSize: 80, color: "text.disabled" }} />
              <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
                Introduce los datos y haz clic en "Calcular Rentabilidad"
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
