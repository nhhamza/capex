import {
  Box,
  Card,
  CardContent,
  Divider,
  Grid,
  LinearProgress,
  Stack,
  Typography,
  Alert,
  Button,
  Tooltip,
} from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import ReceiptIcon from "@mui/icons-material/Receipt";
import DownloadIcon from "@mui/icons-material/Download";
import InfoIcon from "@mui/icons-material/Info";
import dayjs from "dayjs";

import { Property, Lease, Loan, RecurringExpense, Room } from "../types";
import {
  getMonthlyRentForDate,
  computeLeveredMetrics,
  sumClosingCosts,
} from "../calculations";
import { getAggregatedRentForMonth } from "../rentalAggregation";
import { formatCurrency } from "@/utils/format";

interface PropertyQuickViewProps {
  property: Property;
  lease: Lease | null;
  loan: Loan | null;
  recurring: RecurringExpense[];
  leases: Lease[];
  rooms: Room[];
  onTabChange?: (tab: string) => void;
  onExportReport?: () => void;
}

/**
 * Quick view tab showing key metrics at a glance
 * Hero card with cashflow, 4 metrics cards, breakdown, alerts, and quick actions
 */
export function PropertyQuickView({
  property,
  lease,
  loan,
  recurring,
  leases,
  rooms,
  onTabChange,
  onExportReport,
}: PropertyQuickViewProps) {
  const monthDate = dayjs();

  // Calculate monthly rent
  const agg = getAggregatedRentForMonth({
    property,
    leases,
    rooms,
    monthDate,
  });

  let monthlyRent: number;
  let occupancyRate: number;

  if (property.rentalMode === "PER_ROOM") {
    monthlyRent = agg.monthlyGross;
    occupancyRate =
      agg.totalRooms > 0 ? (agg.occupiedRooms / agg.totalRooms) * 100 : 0;
  } else {
    const activeUnitLease = leases.find(
      (l) => !l.roomId && l.isActive !== false,
    );
    if (!activeUnitLease) {
      monthlyRent = 0;
      occupancyRate = 0;
    } else {
      const currentRent = getMonthlyRentForDate(activeUnitLease, monthDate);
      monthlyRent = currentRent;
      occupancyRate = (1 - (activeUnitLease.vacancyPct || 0)) * 100;
    }
  }

  // Calculate expenses - PROPERLY annualize based on periodicity
  const monthlyRecurring = recurring.reduce((sum, exp) => {
    if (exp.periodicity === "monthly") return sum + exp.amount;
    if (exp.periodicity === "quarterly") return sum + exp.amount / 3;
    if (exp.periodicity === "yearly") return sum + exp.amount / 12;
    return sum;
  }, 0);

  const monthlyLoan =
    loan && loan.principal > 0
      ? (loan.principal *
          (loan.annualRatePct / 100 / 12) *
          Math.pow(1 + loan.annualRatePct / 100 / 12, loan.termMonths)) /
        (Math.pow(1 + loan.annualRatePct / 100 / 12, loan.termMonths) - 1)
      : 0;

  // Use computeLeveredMetrics for accurate calculations (including closing costs, proper ROI, cap rate)
  const closingCostsTotal = sumClosingCosts(property.closingCosts);

  // Calculate vacancy percentage - vacancyPct is already stored as decimal (0-1), not percentage
  let vacancyPct = 0;
  if (property.rentalMode === "PER_ROOM") {
    vacancyPct = agg.effectiveVacancyPct;
  } else if (lease) {
    vacancyPct = lease.vacancyPct || 0; // ✅ Already decimal, don't divide by 100
  }

  const metrics = computeLeveredMetrics({
    monthlyRent: monthlyRent * (1 - vacancyPct), // Use net rent after vacancy
    vacancyPct: 0, // Already applied above
    recurring,
    variableAnnualBudget: 0, // Property doesn't have this field yet
    purchasePrice: property.purchasePrice,
    closingCostsTotal,
    currentValue: property.currentValue,
    loan: loan || undefined,
  });

  // Calculate cashflow AFTER getting metrics (to use correct annualized expenses)
  const cashflow = metrics.cfaf / 12; // Use monthly CFAF from levered metrics

  // Extract properly calculated metrics
  const roi = metrics.cashOnCash; // Cash-on-Cash ROI (includes closing costs)
  const capRate = metrics.capRateNet; // Cap Rate based on NOI, not cashflow after debt
  const equityValue = metrics.equity;
  const ltv = metrics.ltv;
  const equityPercent =
    (metrics.equity / (property.currentValue || property.purchasePrice)) * 100;

  const isPositiveCashflow = cashflow > 0;
  const hasLoan = loan && loan.principal > 0;

  return (
    <Box>
      {/* Hero card con cashflow grande */}
      <Card
        sx={{
          mb: 3,
          background: isPositiveCashflow
            ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            : "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
          color: "white",
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Typography variant="overline" sx={{ opacity: 0.9 }}>
            CASHFLOW MENSUAL
          </Typography>
          <Typography variant="h2" fontWeight={900} sx={{ my: 1 }}>
            {cashflow >= 0 ? "+" : ""}
            {formatCurrency(cashflow)}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {cashflow >= 0
              ? `Ganancia neta por mes (${formatCurrency(cashflow * 12)}/año)`
              : `Pérdida mensual (${formatCurrency(cashflow * 12)}/año)`}
          </Typography>
        </CardContent>
      </Card>

      {/* Grid de métricas clave (4 columnas) */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                ROI ANUAL
              </Typography>
              <Typography variant="h4" fontWeight={900}>
                {roi.toFixed(1)}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(Math.max(roi * 10, 0), 100)}
                color={roi > 6 ? "success" : roi > 3 ? "warning" : "error"}
                sx={{ mt: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                Objetivo: 6%+
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                CAP RATE
              </Typography>
              <Typography variant="h4" fontWeight={900}>
                {capRate.toFixed(1)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Rentabilidad bruta
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="caption" color="text.secondary">
                EQUITY
              </Typography>
              <Typography variant="h4" fontWeight={900}>
                {formatCurrency(equityValue)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {equityPercent.toFixed(0)}% del valor
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={6} md={3}>
          <Card>
            <CardContent>
              <Stack
                direction="row"
                alignItems="center"
                spacing={0.5}
                sx={{ mb: 1 }}
              >
                <Typography variant="caption" color="text.secondary">
                  LTV
                </Typography>
                <Tooltip title="Loan-to-Value: deuda / valor actual">
                  <InfoIcon fontSize="small" sx={{ opacity: 0.5 }} />
                </Tooltip>
              </Stack>
              <Typography
                variant="h4"
                fontWeight={900}
                color={
                  ltv > 80
                    ? "error.main"
                    : ltv > 60
                      ? "warning.main"
                      : "success.main"
                }
              >
                {ltv.toFixed(1)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {ltv > 80 ? "Alto riesgo" : ltv > 60 ? "Moderado" : "Seguro"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Breakdown visual: Ingresos vs Gastos */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={900} gutterBottom>
            Desglose mensual
          </Typography>

          <Stack spacing={2}>
            {/* Ingresos */}
            <Box>
              <Stack
                direction="row"
                justifyContent="space-between"
                sx={{ mb: 0.5 }}
              >
                <Typography variant="body2" fontWeight={700}>
                  Ingresos por alquiler
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight={700}
                  color="success.main"
                >
                  +{formatCurrency(monthlyRent)}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={100}
                color="success"
                sx={{ height: 12, borderRadius: 1 }}
              />
            </Box>

            {/* Gastos recurrentes */}
            <Box>
              <Stack
                direction="row"
                justifyContent="space-between"
                sx={{ mb: 0.5 }}
              >
                <Typography variant="body2">Gastos recurrentes</Typography>
                <Typography variant="body2" color="error.main">
                  -{formatCurrency(monthlyRecurring)}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={
                  monthlyRent > 0
                    ? Math.min((monthlyRecurring / monthlyRent) * 100, 100)
                    : 0
                }
                color="warning"
                sx={{ height: 12, borderRadius: 1 }}
              />
            </Box>

            {/* Hipoteca */}
            {hasLoan && (
              <Box>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  sx={{ mb: 0.5 }}
                >
                  <Typography variant="body2">Hipoteca</Typography>
                  <Typography variant="body2" color="error.main">
                    -{formatCurrency(monthlyLoan)}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={
                    monthlyRent > 0
                      ? Math.min((monthlyLoan / monthlyRent) * 100, 100)
                      : 0
                  }
                  color="error"
                  sx={{ height: 12, borderRadius: 1 }}
                />
              </Box>
            )}

            {/* Resultado */}
            <Divider />
            <Box
              sx={{
                p: 2,
                bgcolor: isPositiveCashflow ? "success.light" : "error.light",
                borderRadius: 1,
              }}
            >
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="h6" fontWeight={900}>
                  Cashflow neto
                </Typography>
                <Typography
                  variant="h6"
                  fontWeight={900}
                  color={isPositiveCashflow ? "success.dark" : "error.dark"}
                >
                  {cashflow >= 0 ? "+" : ""}
                  {formatCurrency(cashflow)}
                </Typography>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Alertas y acciones rápidas */}
      <Grid container spacing={2}>
        {/* Alertas */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={900} gutterBottom>
                ⚠️ Estado
              </Typography>

              {!lease && monthlyRent === 0 ? (
                <Alert severity="warning">Sin contrato de arrendamiento</Alert>
              ) : occupancyRate < 100 ? (
                <Alert severity="warning">
                  Ocupación baja ({occupancyRate.toFixed(0)}%)
                </Alert>
              ) : cashflow < 0 ? (
                <Alert severity="error">
                  Pérdidas de {formatCurrency(Math.abs(cashflow))}/mes
                </Alert>
              ) : roi > 8 ? (
                <Alert severity="success">
                  ✅ Excelente ROI: {roi.toFixed(1)}%
                </Alert>
              ) : (
                <Alert severity="success">✅ Todo está en orden</Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Acciones rápidas */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={900} gutterBottom>
                Acciones rápidas
              </Typography>

              <Stack spacing={1}>
                <Button
                  variant="outlined"
                  fullWidth
                  size="small"
                  startIcon={<DescriptionIcon />}
                  onClick={() => onTabChange?.("ingresos")}
                >
                  Ver contrato
                </Button>

                <Button
                  variant="outlined"
                  fullWidth
                  size="small"
                  startIcon={<ReceiptIcon />}
                  onClick={() => onTabChange?.("gastos")}
                >
                  Añadir gasto
                </Button>

                <Button
                  variant="outlined"
                  fullWidth
                  size="small"
                  startIcon={<DownloadIcon />}
                  onClick={onExportReport}
                >
                  Exportar
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
