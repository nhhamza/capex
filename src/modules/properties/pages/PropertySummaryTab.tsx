import { useState } from "react";
import { Grid, Typography, Box, Alert, Button, Collapse } from "@mui/material";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { Property, Lease, Loan, RecurringExpense } from "../types";
import { KPI } from "@/components/KPI";
import { computeLeveredMetrics, sumClosingCosts } from "../calculations";
import { formatPercent, formatCurrency } from "@/utils/format";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ChartTooltip,
  ChartLegend
);

interface PropertySummaryTabProps {
  property: Property;
  lease: Lease | null;
  loan: Loan | null;
  recurring: RecurringExpense[];
}

export function PropertySummaryTab({
  property,
  lease,
  loan,
  recurring,
}: PropertySummaryTabProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!lease) {
    return (
      <Alert severity="info">
        No hay contrato de arrendamiento todavía. Añade uno en la pestaña
        "Contrato" para ver métricas.
      </Alert>
    );
  }

  const closingCostsTotal = sumClosingCosts(property.closingCosts);
  const metrics = computeLeveredMetrics({
    monthlyRent: lease.monthlyRent,
    vacancyPct: lease.vacancyPct || 0,
    recurring,
    variableAnnualBudget: 0,
    purchasePrice: property.purchasePrice,
    closingCostsTotal,
    currentValue: property.currentValue,
    loan: loan || undefined,
  });

  // Chart monthly data
  const chartData = Array.from({ length: 12 }, (_, i) => ({
    month: `M${i + 1}`,
    ingresos: lease.monthlyRent * (1 - (lease.vacancyPct || 0)),
    gastos: metrics.recurringAnnual / 12 + metrics.variableAnnual / 12,
    deuda: loan ? metrics.ads / 12 : 0,
  }));

  return (
    <Box>
      {/* --- QUICK KPIs --- */}
      <Typography variant="h6" gutterBottom>
        Resumen rápido
      </Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {/* KPI 1 */}
        <Grid item xs={12} sm={6} md={3}>
          <KPI
            label="NOI Anual"
            value={formatCurrency(metrics.noi)}
            color={metrics.noi > 0 ? "success" : "error"}
            description="Ingreso Neto Operativo antes de deuda."
          />
        </Grid>

        {/* KPI 2 */}
        <Grid item xs={12} sm={6} md={3}>
          <KPI
            label="Cap Rate Neto"
            value={formatPercent(metrics.capRateNet, 2)}
            color="primary"
            description="NOI dividido por el coste total de compra."
          />
        </Grid>

        {/* KPI 3 */}
        <Grid item xs={12} sm={6} md={3}>
          <KPI
            label="Cash-on-Cash"
            value={formatPercent(metrics.cashOnCash, 2)}
            color={metrics.cashOnCash > 0 ? "success" : "error"}
            description="Cashflow anual dividido por inversión inicial."
          />
        </Grid>

        {/* KPI 4 */}
        <Grid item xs={12} sm={6} md={3}>
          <KPI
            label="CFAF Anual"
            value={formatCurrency(metrics.cfaf)}
            color={metrics.cfaf > 0 ? "success" : "error"}
            description="Cashflow después de pagar la hipoteca."
          />
        </Grid>
      </Grid>

      <Button
        size="small"
        variant="outlined"
        sx={{ mb: 3 }}
        onClick={() => setShowAdvanced((prev) => !prev)}
      >
        {showAdvanced ? "Ocultar métricas avanzadas" : "Ver métricas avanzadas"}
      </Button>

      {/* --- ADVANCED KPI SECTION --- */}
      <Collapse in={showAdvanced}>
        <Typography variant="subtitle1" gutterBottom sx={{ mt: 1 }}>
          KPIs avanzados
        </Typography>

        <Grid container spacing={2} sx={{ mb: 4 }}>
          {/* DSCR */}
          <Grid item xs={12} sm={6} md={3}>
            <KPI
              label="DSCR"
              value={metrics.dscr > 0 ? metrics.dscr.toFixed(2) : "N/A"}
              color={metrics.dscr >= 1.25 ? "success" : "warning"}
              description="Capacidad para cubrir deuda con NOI."
            />
          </Grid>

          {/* LTV Actual */}
          <Grid item xs={12} sm={6} md={3}>
            <KPI
              label="LTV Actual"
              value={formatPercent(metrics.ltv, 1)}
              color={
                metrics.ltv < 65
                  ? "success"
                  : metrics.ltv < 80
                  ? "warning"
                  : "error"
              }
              description="Porcentaje del valor que está financiado."
            />
          </Grid>

          {/* Yield Actual */}
          {property.currentValue && (
            <Grid item xs={12} sm={6} md={3}>
              <KPI
                label="Yield Actual"
                value={formatPercent(
                  (metrics.rentAnnualGross / property.currentValue) * 100,
                  2
                )}
                color="primary"
                description="Ingresos brutos dividido por valor actual."
              />
            </Grid>
          )}

          {/* ADS Anual (solo si hay préstamo) */}
          {loan && (
            <Grid item xs={12} sm={6} md={3}>
              <KPI
                label="ADS Anual"
                value={formatCurrency(metrics.ads)}
                color="secondary"
                description="Cuotas anuales de hipoteca (capital + intereses)."
              />
            </Grid>
          )}

          {/* LTV (detalle, solo si hay préstamo) */}
          {loan && (
            <Grid item xs={12} sm={6} md={3}>
              <KPI
                label="LTV"
                value={formatPercent(metrics.ltv, 1)}
                color="secondary"
                description="Proporción de deuda sobre valor."
              />
            </Grid>
          )}

          {/* Equity (solo si hay préstamo) */}
          {loan && (
            <Grid item xs={12} sm={6} md={3}>
              <KPI
                label="Equity"
                value={formatCurrency(metrics.equity)}
                color="primary"
                description="Patrimonio neto en la propiedad."
              />
            </Grid>
          )}
        </Grid>
      </Collapse>

      {/* --- CASHFLOW CHART --- */}
      <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
        Flujo de Caja (12 meses)
      </Typography>

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={loan ? 4 : 6}>
          <Box
            sx={{
              textAlign: "center",
              p: 1,
              bgcolor: "rgba(76, 175, 80, 0.08)",
              borderRadius: 1,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              Ingreso Mensual
            </Typography>
            <Typography variant="body2" fontWeight="bold" color="#4caf50">
              {formatCurrency(chartData[0]?.ingresos ?? 0)}
            </Typography>
          </Box>
        </Grid>

        <Grid item xs={loan ? 4 : 6}>
          <Box
            sx={{
              textAlign: "center",
              p: 1,
              bgcolor: "rgba(255, 152, 0, 0.08)",
              borderRadius: 1,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              Gastos Mensuales
            </Typography>
            <Typography variant="body2" fontWeight="bold" color="#ff9800">
              {formatCurrency(chartData[0]?.gastos ?? 0)}
            </Typography>
          </Box>
        </Grid>

        {loan && (
          <Grid item xs={4}>
            <Box
              sx={{
                textAlign: "center",
                p: 1,
                bgcolor: "rgba(244, 67, 54, 0.08)",
                borderRadius: 1,
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
              >
                Cuota Mensual
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="#f44336">
                {formatCurrency(chartData[0]?.deuda ?? 0)}
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>

      <Box sx={{ height: { xs: 200, sm: 250 } }}>
        <Bar
          data={{
            labels: chartData.map((d) => d.month),
            datasets: [
              {
                label: "Ingresos",
                data: chartData.map((d) => d.ingresos),
                backgroundColor: "rgba(76, 175, 80, 0.8)",
                borderColor: "#4caf50",
                borderWidth: 1,
              },
              {
                label: "Gastos",
                data: chartData.map((d) => d.gastos),
                backgroundColor: "rgba(255, 152, 0, 0.8)",
                borderColor: "#ff9800",
                borderWidth: 1,
              },
              ...(loan
                ? [
                    {
                      label: "Deuda",
                      data: chartData.map((d) => d.deuda),
                      backgroundColor: "rgba(244, 67, 54, 0.8)",
                      borderColor: "#f44336",
                      borderWidth: 1,
                    },
                  ]
                : []),
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                position: "top",
                labels: {
                  usePointStyle: true,
                  padding: 12,
                  font: { size: 10 },
                },
              },
              tooltip: {
                enabled: true,
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                titleColor: "#000",
                bodyColor: "#666",
                borderColor: "#ddd",
                borderWidth: 1,
                padding: 12,
                callbacks: {
                  label: (context) =>
                    `${context.dataset.label}: ${formatCurrency(
                      context.parsed.y ?? 0
                    )}`,
                },
              },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { font: { size: 9 } },
              },
              y: {
                grid: { color: "rgba(0, 0, 0, 0.05)" },
                ticks: {
                  callback: (value) => formatCurrency(value as number),
                  font: { size: 9 },
                },
              },
            },
          }}
        />
      </Box>

      {!property.closingCosts && (
        <Alert severity="info" sx={{ mt: 3 }}>
          Aún no has detallado los costes de cierre (ITP, notaría, registro,
          etc.). Añádelos en la pestaña "Compra" para mejorar el cálculo de
          inversión total y métricas.
        </Alert>
      )}
    </Box>
  );
}
