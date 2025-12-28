import { useState } from "react";
import { Grid, Typography, Box, Alert, Button, Collapse, TextField, Divider } from "@mui/material";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import dayjs from "dayjs";
import { Property, Lease, Loan, RecurringExpense, Room } from "../types";
import { KPI } from "@/components/KPI";
import { computeLeveredMetrics, sumClosingCosts } from "../calculations";
import { formatPercent, formatCurrency } from "@/utils/format";
import { getAggregatedRentForMonth } from "../rentalAggregation";
import { updateProperty } from "../api";

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

  // 👇 NUEVOS (opcionales para compat)
  leases?: Lease[];
  rooms?: Room[];
  onSave: () => void;
}

export function PropertySummaryTab({
  property,
  lease,
  loan,
  recurring,
  leases,
  rooms,
  onSave,
}: PropertySummaryTabProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [notes, setNotes] = useState(property.notes || '');
  const [savingNotes, setSavingNotes] = useState(false);

  // Si no hay lease y tampoco leases de habitaciones, mostramos aviso
  const hasAnyLease =
    !!lease ||
    (leases && leases.length > 0 && property.rentalMode === "PER_ROOM");

  if (!hasAnyLease) {
    return (
      <Alert severity="info">
        No hay contrato de arrendamiento todavía. Añade uno en la pestaña
        {property.rentalMode === "PER_ROOM"
          ? ' "Habitaciones" o "Contrato" para ver métricas.'
          : ' "Contrato" para ver métricas.'}
      </Alert>
    );
  }

  const closingCostsTotal = sumClosingCosts(property.closingCosts);

  // ==========================
  // 1) Calcular renta mensual para metrics
  // ==========================
  let monthlyRentForMetrics = 0;
  let vacancyPctForMetrics = 0;

  if (property.rentalMode === "PER_ROOM" && leases && rooms) {
    const now = dayjs();
    const agg = getAggregatedRentForMonth({
      property,
      leases,
      rooms,
      monthDate: now,
    });

    monthlyRentForMetrics = agg.monthlyGross; // usamos la renta bruta como base
    vacancyPctForMetrics = agg.effectiveVacancyPct; // 0..1
  } else if (lease) {
    // Modo vivienda completa (actual)
    monthlyRentForMetrics = lease.monthlyRent;
    vacancyPctForMetrics = lease.vacancyPct || 0;
  }

  const metrics = computeLeveredMetrics({
    monthlyRent: monthlyRentForMetrics,
    vacancyPct: vacancyPctForMetrics,
    recurring,
    variableAnnualBudget: 0,
    purchasePrice: property.purchasePrice,
    closingCostsTotal,
    currentValue: property.currentValue,
    loan: loan || undefined,
  });

  // ==========================
  // 2) Datos para gráfico 12 meses
  // ==========================

  // Por ahora mantenemos una serie "plana" como antes:
  // mismos valores mensuales (si más adelante quieres que varíe por meses, se puede refinar).
  const ingresosMensuales =
    property.rentalMode === "PER_ROOM" && leases && rooms
      ? (() => {
          const now = dayjs();
          const agg = getAggregatedRentForMonth({
            property,
            leases,
            rooms,
            monthDate: now,
          });
          return agg.monthlyNet;
        })()
      : lease
        ? lease.monthlyRent * (1 - (lease.vacancyPct || 0))
        : 0;

  const chartData = Array.from({ length: 12 }, (_, i) => ({
    month: `M${i + 1}`,
    ingresos: ingresosMensuales,
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

          {/* KPIs extra solo para PER_ROOM */}
          {property.rentalMode === "PER_ROOM" && leases && rooms && (
            <>
              <Grid item xs={12} sm={6} md={3}>
                <KPI
                  label="Habitaciones ocupadas"
                  value={`${
                    getAggregatedRentForMonth({
                      property,
                      leases,
                      rooms,
                      monthDate: dayjs(),
                    }).occupiedRooms
                  } / ${rooms.length || 0}`}
                  color="primary"
                  description="Número de habitaciones que tienen un contrato activo este mes."
                />
              </Grid>
            </>
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

      {/* --- NOTAS SECTION --- */}
      <Divider sx={{ my: 4 }} />

      <Typography variant="h6" gutterBottom>
        Notas
      </Typography>

      <Box>
        <TextField
          fullWidth
          label="Notas de la propiedad"
          multiline
          rows={8}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Añade notas personales sobre esta propiedad..."
        />
        <Button
          variant="contained"
          onClick={async () => {
            setSavingNotes(true);
            try {
              await updateProperty(property.id, { notes });
              onSave();
            } catch (error) {
              console.error('Error saving notes:', error);
            } finally {
              setSavingNotes(false);
            }
          }}
          disabled={savingNotes}
          sx={{ mt: 2 }}
        >
          {savingNotes ? 'Guardando...' : 'Guardar Notas'}
        </Button>
      </Box>
    </Box>
  );
}
