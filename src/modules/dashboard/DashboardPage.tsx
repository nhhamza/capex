import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Grid,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  useTheme,
  alpha,
  Skeleton,
  CircularProgress,
  Chip,
  Button,
  Stack,
  Alert,
  Divider,
  Tooltip,
} from "@mui/material";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import PaidIcon from "@mui/icons-material/Paid";
import HomeIcon from "@mui/icons-material/Home";
import InfoIcon from "@mui/icons-material/Info";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  ChartTooltip,
  ChartLegend,
);

import dayjs from "dayjs";
import { useAuth } from "@/auth/authContext";
import { getDashboard } from "@/modules/properties/api";
import { Property, Room } from "@/modules/properties/types";
import {
  computeLeveredMetrics,
  sumClosingCosts,
  getMonthlyRentForDate,
} from "@/modules/properties/calculations";
import { getAggregatedRentForMonth } from "@/modules/properties/rentalAggregation";
import { formatCurrency } from "@/utils/format";
import {
  calculateYTDCashflow,
  calculateYearProjection,
  determineTrend,
} from "./calculations";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { AchievementBadges } from "@/modules/achievements/AchievementBadges";

interface OneOffExpense {
  date: string;
  amount: number;
}

export function DashboardPage() {
  const { userDoc } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useTheme();

  const isDemoMode = searchParams.get("demo") === "true";
  const isOnboardingDone = searchParams.get("onboarding") === "done";
  const [showDemoAlert, setShowDemoAlert] = useState(isDemoMode);

  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");

  const [totalIncome, setTotalIncome] = useState(0);
  const [totalRecurringExpenses, setTotalRecurringExpenses] = useState(0);
  const [totalOneOffExpenses, setTotalOneOffExpenses] = useState(0);
  const [chartData, setChartData] = useState<
    { month: string; ingresos: number; gastos: number; flujoNeto: number }[]
  >([]);
  const [avgCashOnCash, setAvgCashOnCash] = useState(0);
  const [totalPrincipal, setTotalPrincipal] = useState(0);
  const [totalCurrentValue, setTotalCurrentValue] = useState(0);
  const [totalPurchasePrice, setTotalPurchasePrice] = useState(0);
  const [_totalMonthlyLoanPayment, setTotalMonthlyLoanPayment] = useState(0);
  const [loading, setLoading] = useState(false);

  // New states for best/worst property metrics
  const [bestProperty, setBestProperty] = useState<Property | null>(null);
  const [worstProperty, setWorstProperty] = useState<Property | null>(null);
  const [bestPropertyCashflow, setBestPropertyCashflow] = useState(0);
  const [worstPropertyCashflow, setWorstPropertyCashflow] = useState(0);

  // YTD and Projection metrics
  const [ytdCashflow, setYtdCashflow] = useState(0);
  const [yearProjection, setYearProjection] = useState(0);
  const [cashflowTrend, setCashflowTrend] = useState<"up" | "down" | "neutral">(
    "neutral",
  );

  useEffect(() => {
    const loadData = async () => {
      if (!userDoc?.orgId) {
        setProperties([]);
        setChartData([]);

        setAvgCashOnCash(0);
        setTotalPrincipal(0);
        setTotalCurrentValue(0);
        setTotalPurchasePrice(0);
        setTotalMonthlyLoanPayment(0);
        return;
      }

      setLoading(true);
      try {
        const dash = await getDashboard();
        const props = dash.properties || [];
        setProperties(props);

        const filteredProps =
          selectedPropertyId === "all"
            ? props
            : props.filter((p) => p.id === selectedPropertyId);

        if (filteredProps.length === 0) {
          setChartData([]);
          setTotalIncome(0);
          setTotalRecurringExpenses(0);
          setTotalOneOffExpenses(0);
          setAvgCashOnCash(0);
          setTotalPrincipal(0);
          setTotalCurrentValue(0);
          setTotalPurchasePrice(0);
          setTotalMonthlyLoanPayment(0);
          return;
        }

        // --- Data already loaded in parallel by backend (/api/dashboard) ---
        const leasesAll = (dash.leases || []) as any[];
        const loansAll = (dash.loans || []) as any[];
        const recurringAll = (dash.recurringExpenses || []) as any[];
        const oneOffAll = (dash.oneOffExpenses || []) as any[];
        const roomsAll = (dash.rooms || []) as any[];

        const leasesEntries = filteredProps.map(
          (prop) =>
            [
              prop.id,
              leasesAll.filter((x) => x.propertyId === prop.id),
            ] as const,
        );
        const loansEntries = filteredProps.map(
          (prop) =>
            [
              prop.id,
              loansAll.filter((x) => x.propertyId === prop.id),
            ] as const,
        );
        const recurringEntries = filteredProps.map(
          (prop) =>
            [
              prop.id,
              recurringAll.filter((x) => x.propertyId === prop.id),
            ] as const,
        );
        const oneOffEntries = filteredProps.map(
          (prop) =>
            [
              prop.id,
              oneOffAll.filter((x) => x.propertyId === prop.id),
            ] as const,
        );
        const roomsEntries = filteredProps
          .filter((prop) => prop.rentalMode === "PER_ROOM")
          .map(
            (prop) =>
              [
                prop.id,
                roomsAll.filter((x) => x.propertyId === prop.id),
              ] as const,
          );

        const leasesByProp: Record<string, any[]> = {};
        leasesEntries.forEach(([id, leases]) => {
          leasesByProp[id] = leases;
        });

        const loansByProp: Record<string, any[]> = {};
        loansEntries.forEach(([id, loans]) => {
          loansByProp[id] = loans;
        });

        const recurringByProp: Record<string, any[]> = {};
        recurringEntries.forEach(([id, rec]) => {
          recurringByProp[id] = rec;
        });

        const oneOffByProp: Record<string, OneOffExpense[]> = {};
        oneOffEntries.forEach(([id, capex]) => {
          oneOffByProp[id] = capex;
        });

        const roomsByProp: Record<string, Room[]> = {};
        roomsEntries.forEach(([id, rooms]) => {
          roomsByProp[id] = rooms;
        });

        // --- Aggregations ---

        let cfaf = 0;
        let annualIncome = 0;
        let annualRecurringExpenses = 0;
        let annualOneOffExpenses = 0;
        let totalEquitySum = 0;
        let weightedCashOnCash = 0;
        let weightedCapRate = 0;
        let totalPrincipal = 0;
        let totalCurrentValue = 0;
        let totalPurchasePrice = 0;
        let totalMonthlyLoanPayment = 0;

        const monthlyData: Record<
          number,
          { ingresos: number; gastos: number; flujoNeto: number }
        > = {};
        for (let i = 1; i <= 12; i++) {
          monthlyData[i] = { ingresos: 0, gastos: 0, flujoNeto: 0 };
        }

        const currentYear = new Date().getFullYear();

        for (const prop of filteredProps) {
          const leases = leasesByProp[prop.id] || [];
          const lease = leases[0];

          const loans = loansByProp[prop.id] || [];
          const loan = loans[0];

          const rooms = roomsByProp[prop.id] || [];

          // Add purchase price
          totalPurchasePrice += prop.purchasePrice || 0;

          // Debt ratio: always based on loan + current value, even if no lease
          if (loan) {
            totalPrincipal += loan.principal;
          }

          const valueToAdd =
            typeof prop.currentValue === "number" && prop.currentValue > 0
              ? prop.currentValue
              : prop.purchasePrice;

          totalCurrentValue += valueToAdd;

          // If no lease and not PER_ROOM with rooms, skip the rest of metrics for this property
          const hasLease = !!lease;
          const hasRoomsForPerRoom =
            prop.rentalMode === "PER_ROOM" && rooms.length > 0;
          if (!hasLease && !hasRoomsForPerRoom) continue;

          const recurring = recurringByProp[prop.id] || [];
          const oneOffExpenses = oneOffByProp[prop.id] || [];

          // Calculate aggregated rent for metrics
          let monthlyRentForMetrics = 0;
          let vacancyPctForMetrics = 0;

          if (prop.rentalMode === "PER_ROOM" && rooms.length > 0) {
            const aggNow = getAggregatedRentForMonth({
              property: prop,
              leases,
              rooms,
              monthDate: dayjs(),
            });
            monthlyRentForMetrics = aggNow.monthlyGross;
            vacancyPctForMetrics = aggNow.effectiveVacancyPct;
          } else if (lease) {
            monthlyRentForMetrics = getMonthlyRentForDate(lease, dayjs());
            vacancyPctForMetrics = lease.vacancyPct || 0;
          }

          const closingCostsTotal = sumClosingCosts(prop.closingCosts);
          const metrics = computeLeveredMetrics({
            monthlyRent: monthlyRentForMetrics,
            vacancyPct: vacancyPctForMetrics,
            recurring,
            variableAnnualBudget: 0,
            purchasePrice: prop.purchasePrice,
            closingCostsTotal,
            currentValue: prop.currentValue,
            loan,
          });

          cfaf += metrics.cfaf;
          totalMonthlyLoanPayment += loan ? metrics.ads / 12 : 0;

          // Calculate annual income
          let yearlyRent = 0;
          if (prop.rentalMode === "PER_ROOM" && rooms.length > 0) {
            for (let month = 0; month < 12; month++) {
              const monthDate = dayjs().year(currentYear).month(month);
              const agg = getAggregatedRentForMonth({
                property: prop,
                leases,
                rooms,
                monthDate,
              });
              yearlyRent += agg.monthlyNet;
            }
          } else if (lease) {
            // Calculate month by month to account for rent adjustments throughout the year
            for (let month = 0; month < 12; month++) {
              const monthDate = dayjs().year(currentYear).month(month);
              const monthlyRent = getMonthlyRentForDate(lease, monthDate);
              yearlyRent += monthlyRent * (1 - (lease.vacancyPct || 0));
            }
          }
          annualIncome += yearlyRent;

          annualRecurringExpenses +=
            metrics.recurringAnnual + metrics.variableAnnual;

          totalEquitySum += metrics.equity;
          weightedCashOnCash += metrics.cashOnCash * metrics.equity;
          weightedCapRate += metrics.capRateNet * metrics.equity;

          const yearOneOffExpenses = oneOffExpenses
            .filter((exp) => new Date(exp.date).getFullYear() === currentYear)
            .reduce((sum, exp) => sum + exp.amount, 0);
          annualOneOffExpenses += yearOneOffExpenses;

          // Calculate monthly data
          for (let i = 1; i <= 12; i++) {
            const monthDate = dayjs()
              .year(currentYear)
              .month(i - 1);
            let monthlyRent = 0;

            if (prop.rentalMode === "PER_ROOM" && rooms.length > 0) {
              const agg = getAggregatedRentForMonth({
                property: prop,
                leases,
                rooms,
                monthDate,
              });
              monthlyRent = agg.monthlyNet;
            } else if (lease) {
              monthlyRent =
                getMonthlyRentForDate(lease, monthDate) *
                (1 - (lease.vacancyPct || 0));
            }

            const monthlyExpenses =
              (metrics.recurringAnnual + metrics.variableAnnual) / 12;
            const monthlyDebt = loan ? metrics.ads / 12 : 0;

            monthlyData[i].ingresos += monthlyRent;
            monthlyData[i].gastos += monthlyExpenses + monthlyDebt;
          }

          oneOffExpenses
            .filter((exp) => new Date(exp.date).getFullYear() === currentYear)
            .forEach((exp) => {
              const expMonth = new Date(exp.date).getMonth() + 1;
              monthlyData[expMonth].gastos += exp.amount;
            });
        }

        // Calculate flujo neto for each month
        Object.keys(monthlyData).forEach((month) => {
          const m = parseInt(month);
          monthlyData[m].flujoNeto =
            monthlyData[m].ingresos - monthlyData[m].gastos;
        });

        // Calculate best and worst properties by cashflow (INCLUYENDO HIPOTECA)
        const propertiesWithCashflow = filteredProps
          .filter((prop) => {
            // Solo incluir propiedades con lease o PER_ROOM con rooms
            const hasLease = (leasesByProp[prop.id] || []).length > 0;
            const hasRooms =
              prop.rentalMode === "PER_ROOM" &&
              (roomsByProp[prop.id] || []).length > 0;
            return hasLease || hasRooms;
          })
          .map((prop) => {
            const leases = leasesByProp[prop.id] || [];
            const loans = loansByProp[prop.id] || [];
            const loan = loans[0];
            const recurring = recurringByProp[prop.id] || [];
            const rooms = roomsByProp[prop.id] || [];

            // Calcular ingresos mensuales según modo de renta
            let monthlyIncome = 0;
            if (prop.rentalMode === "PER_ROOM" && rooms.length > 0) {
              const agg = getAggregatedRentForMonth({
                property: prop,
                leases,
                rooms,
                monthDate: dayjs(),
              });
              monthlyIncome = agg.monthlyNet;
            } else {
              const activeLease = leases.find((l) => !l.roomId);
              if (activeLease) {
                const rent = getMonthlyRentForDate(activeLease, dayjs());
                monthlyIncome = rent * (1 - (activeLease.vacancyPct || 0));
              }
            }

            // Calcular gastos mensuales (considerando periodicidad)
            const monthlyRecurring = recurring.reduce((sum, exp) => {
              if (exp.periodicity === "monthly") return sum + exp.amount;
              if (exp.periodicity === "quarterly") return sum + exp.amount / 3;
              if (exp.periodicity === "yearly") return sum + exp.amount / 12;
              return sum;
            }, 0);

            // Pago mensual de hipoteca
            const monthlyLoan = loan?.monthlyPayment || 0;

            // Cashflow = Ingresos - Gastos - Hipoteca
            const cashflow = monthlyIncome - monthlyRecurring - monthlyLoan;

            return {
              ...prop,
              monthlyIncome,
              monthlyRecurring,
              monthlyLoan,
              cashflow,
            };
          });

        if (propertiesWithCashflow.length > 0) {
          const sorted = [...propertiesWithCashflow].sort(
            (a, b) => b.cashflow - a.cashflow,
          );
          setBestProperty(sorted[0] as Property);
          setBestPropertyCashflow(sorted[0].cashflow);
          setWorstProperty(sorted[sorted.length - 1] as Property);
          setWorstPropertyCashflow(sorted[sorted.length - 1].cashflow);
        }

        // Calculate YTD and projection (CORRECTED: include all deductions)
        const totalAnnualLoanPayments = totalMonthlyLoanPayment * 12;
        const ytd = calculateYTDCashflow(
          annualIncome,
          annualRecurringExpenses + annualOneOffExpenses,
          totalAnnualLoanPayments,
        );
        setYtdCashflow(ytd);

        // Projection: monthly average AFTER all deductions
        const monthlyNetCashflow =
          (annualIncome -
            annualRecurringExpenses -
            annualOneOffExpenses -
            totalAnnualLoanPayments) /
          12;
        const projection = calculateYearProjection(monthlyNetCashflow);
        setYearProjection(projection);

        // Calculate trend: compare net cashflow, not just income
        const trend = determineTrend(monthlyNetCashflow, 0);
        setCashflowTrend(trend);

        setTotalIncome(annualIncome); // Store ANNUAL
        setTotalRecurringExpenses(annualRecurringExpenses); // Store ANNUAL
        setTotalOneOffExpenses(annualOneOffExpenses); // Store ANNUAL
        setTotalPrincipal(totalPrincipal);
        setTotalCurrentValue(totalCurrentValue);
        setTotalPurchasePrice(totalPurchasePrice);
        setTotalMonthlyLoanPayment(totalMonthlyLoanPayment);

        if (totalEquitySum > 0) {
          setAvgCashOnCash(weightedCashOnCash / totalEquitySum);
        } else {
          setAvgCashOnCash(0);
        }

        const monthNames = [
          "Ene",
          "Feb",
          "Mar",
          "Abr",
          "May",
          "Jun",
          "Jul",
          "Ago",
          "Sep",
          "Oct",
          "Nov",
          "Dic",
        ];

        setChartData(
          Object.keys(monthlyData).map((month) => ({
            month: monthNames[parseInt(month) - 1],
            ...monthlyData[parseInt(month)],
          })),
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userDoc, selectedPropertyId]);

  // Calculate derived metrics
  const plusvalia = totalCurrentValue - totalPurchasePrice;
  const plusvaliaPercent =
    totalPurchasePrice > 0 ? (plusvalia / totalPurchasePrice) * 100 : 0;

  // LTV (Loan-to-Value): deuda total / valor actual
  const ltv =
    totalCurrentValue > 0 ? (totalPrincipal / totalCurrentValue) * 100 : 0;

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
            Panel de Inversión
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Resumen del rendimiento de tu portfolio inmobiliario
          </Typography>
        </Box>
        <FormControl sx={{ minWidth: { xs: 150, sm: 250 } }}>
          <InputLabel>Vivienda</InputLabel>
          <Select
            value={selectedPropertyId}
            label="Vivienda"
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            size="medium"
            disabled={loading}
          >
            <MenuItem value="all">Todo el Portfolio</MenuItem>
            {properties.map((prop) => (
              <MenuItem key={prop.id} value={prop.id}>
                {prop.address}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Demo Mode Alert */}
      {showDemoAlert && (
        <Alert
          severity="info"
          onClose={() => setShowDemoAlert(false)}
          sx={{ mb: 3 }}
        >
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
            ℹ️ Estás en modo demo
          </Typography>
          <Typography variant="body2">
            Estás explorando con datos de ejemplo. Puedes editar y explorar
            libremente, o crea tu primera propiedad real para comenzar.
          </Typography>
        </Alert>
      )}

      {/* Onboarding Done Alert */}
      {isOnboardingDone && !isDemoMode && (
        <Alert
          severity="success"
          onClose={() => {
            const params = new URLSearchParams(searchParams);
            params.delete("onboarding");
            setSearchParams(params);
          }}
          sx={{ mb: 3 }}
        >
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
            🎉 ¡Bienvenido!
          </Typography>
          <Typography variant="body2">
            Tu primera propiedad ha sido creada exitosamente. Explora el
            dashboard para ver todas tus métricas.
          </Typography>
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            py: 8,
          }}
        >
          <CircularProgress size={48} />
        </Box>
      )}

      {/* Empty State */}
      {!loading && properties.length === 0 && (
        <Paper sx={{ p: 6, textAlign: "center", mb: 4 }}>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
            ¡Bienvenido a tu Panel de Inversión!
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Comienza añadiendo tu primera vivienda para ver aquí todas las
            métricas de rentabilidad y rendimiento de tu portfolio inmobiliario.
          </Typography>
          <Button
            variant="contained"
            size="large"
            href="/properties/new"
            sx={{ mt: 2 }}
          >
            Añadir Primera Vivienda
          </Button>
        </Paper>
      )}

      {/* SECTION 1: HERO CARD - ANNUAL CASHFLOW */}
      {properties.length > 0 && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12}>
            <Card
              sx={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                color: "white",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  top: -50,
                  right: -50,
                  width: 200,
                  height: 200,
                  borderRadius: "50%",
                  background: alpha("rgba(255,255,255,0.1)", 1),
                }}
              />
              <CardContent sx={{ p: 4, position: "relative", zIndex: 1 }}>
                <Typography variant="overline" sx={{ opacity: 0.9 }}>
                  TU CASHFLOW ESTE AÑO (DESPUÉS DE TODO)
                </Typography>

                {loading ? (
                  <Skeleton
                    variant="text"
                    width={250}
                    height={80}
                    sx={{ bgcolor: alpha("#fff", 0.2), my: 2 }}
                  />
                ) : (
                  <Typography variant="h2" fontWeight={900} sx={{ my: 2 }}>
                    {ytdCashflow >= 0 ? "+" : ""}
                    {formatCurrency(ytdCashflow)}
                  </Typography>
                )}

                <Typography variant="body1" sx={{ opacity: 0.9, mb: 3 }}>
                  Ganancia neta después de hipotecas, gastos e impuestos
                  <br />
                  <strong>
                    {formatCurrency(ytdCashflow / 12)}/mes promedio
                  </strong>
                </Typography>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  {cashflowTrend === "up" ? (
                    <>
                      <ArrowUpwardIcon />
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Tendencia positiva vs mes anterior
                      </Typography>
                    </>
                  ) : cashflowTrend === "down" ? (
                    <>
                      <ArrowDownwardIcon />
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Tendencia negativa vs mes anterior
                      </Typography>
                    </>
                  ) : (
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Estable vs mes anterior
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* SECTION 2: 4 KPIs PRINCIPALES */}
      {properties.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {/* KPI 1: Portfolio Value */}
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ mb: 1 }}
                >
                  <HomeIcon color="primary" />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 600 }}
                  >
                    VALOR DEL PORTFOLIO
                  </Typography>
                </Stack>

                {loading ? (
                  <Skeleton variant="text" width={140} height={40} />
                ) : (
                  <Typography variant="h4" fontWeight={900}>
                    {formatCurrency(totalCurrentValue)}
                  </Typography>
                )}

                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {properties.length}{" "}
                    {properties.length === 1 ? "propiedad" : "propiedades"}
                  </Typography>
                  {plusvalia > 0 && (
                    <>
                      {" • "}
                      <Typography
                        variant="caption"
                        color="success.main"
                        sx={{ fontWeight: 600 }}
                      >
                        +{plusvaliaPercent.toFixed(1)}% plusvalía
                      </Typography>
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* KPI 2: ROI Average */}
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ mb: 1 }}
                >
                  <TrendingUpIcon color="success" />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 600 }}
                  >
                    ROI PROMEDIO
                  </Typography>
                  <Tooltip title="Cash-on-Cash Return: rentabilidad sobre el capital invertido">
                    <InfoIcon fontSize="small" sx={{ opacity: 0.5 }} />
                  </Tooltip>
                </Stack>

                {loading ? (
                  <Skeleton variant="text" width={100} height={40} />
                ) : (
                  <Typography variant="h4" fontWeight={900}>
                    {avgCashOnCash.toFixed(1)}%
                  </Typography>
                )}

                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Retorno anual
                  </Typography>
                  {avgCashOnCash > 6 && (
                    <>
                      {" • "}
                      <Typography
                        variant="caption"
                        color="success.main"
                        sx={{ fontWeight: 600 }}
                      >
                        ¡Excelente!
                      </Typography>
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* KPI 3: Annual Income */}
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ mb: 1 }}
                >
                  <PaidIcon color="primary" />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 600 }}
                  >
                    INGRESOS ANUALES
                  </Typography>
                </Stack>

                {loading ? (
                  <Skeleton variant="text" width={140} height={40} />
                ) : (
                  <Typography variant="h4" fontWeight={900}>
                    {formatCurrency(totalIncome)}
                  </Typography>
                )}

                <Typography variant="caption" color="text.secondary">
                  {formatCurrency(totalIncome / 12)}/mes promedio
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* KPI 4: Loan-to-Value (LTV) */}
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{ mb: 1 }}
                >
                  <AccountBalanceWalletIcon color="error" />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 600 }}
                  >
                    ENDEUDAMIENTO (LTV)
                  </Typography>
                  <Tooltip title="Loan-to-Value: deuda total / valor actual del portfolio">
                    <InfoIcon fontSize="small" sx={{ opacity: 0.5 }} />
                  </Tooltip>
                </Stack>

                {loading ? (
                  <Skeleton variant="text" width={100} height={40} />
                ) : (
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
                )}

                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Deuda: {formatCurrency(totalPrincipal)}
                  </Typography>
                  {ltv > 80 && (
                    <>
                      {" • "}
                      <Typography
                        variant="caption"
                        color="error.main"
                        sx={{ fontWeight: 600 }}
                      >
                        Alto
                      </Typography>
                    </>
                  )}
                  {ltv <= 60 && (
                    <>
                      {" • "}
                      <Typography
                        variant="caption"
                        color="success.main"
                        sx={{ fontWeight: 600 }}
                      >
                        Seguro
                      </Typography>
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
      {properties.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {/* Best vs Worst Property */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={900} gutterBottom>
                  📊 Rendimiento de propiedades
                </Typography>

                <Stack spacing={2}>
                  {/* Best Property */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: "success.light",
                      border: "2px solid",
                      borderColor: "success.main",
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Typography fontSize={32}>🏆</Typography>
                      <Box flex={1}>
                        <Typography variant="caption" color="text.secondary">
                          MEJOR PROPIEDAD
                        </Typography>
                        <Typography variant="body1" fontWeight={700} noWrap>
                          {bestProperty?.address || "N/A"}
                        </Typography>
                        <Typography
                          variant="h6"
                          color="success.dark"
                          fontWeight={900}
                        >
                          {loading ? (
                            <Skeleton variant="text" width={100} />
                          ) : (
                            `${bestPropertyCashflow >= 0 ? "+" : ""}${formatCurrency(bestPropertyCashflow)}/mes`
                          )}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>

                  {/* Worst Property */}
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: "grey.100",
                      border: "2px solid",
                      borderColor: "grey.300",
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Typography fontSize={32}>📉</Typography>
                      <Box flex={1}>
                        <Typography variant="caption" color="text.secondary">
                          MENOR RENDIMIENTO
                        </Typography>
                        <Typography variant="body1" fontWeight={700} noWrap>
                          {worstProperty?.address || "N/A"}
                        </Typography>
                        <Typography variant="h6" fontWeight={900}>
                          {loading ? (
                            <Skeleton variant="text" width={100} />
                          ) : (
                            formatCurrency(worstPropertyCashflow) + "/mes"
                          )}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>

                  {/* Difference Alert */}
                  <Alert severity="info">
                    Diferencia:{" "}
                    <strong>
                      {loading ? (
                        <Skeleton variant="text" width={100} />
                      ) : (
                        `${formatCurrency(bestPropertyCashflow - worstPropertyCashflow)}/mes`
                      )}
                    </strong>
                  </Alert>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Projection & Achievements */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={900} gutterBottom>
                  🔮 Proyección
                </Typography>

                <Box
                  sx={{
                    p: 3,
                    bgcolor: "info.light",
                    borderRadius: 2,
                    textAlign: "center",
                    mb: 3,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    SI MANTIENES EL RITMO ACTUAL
                  </Typography>
                  {loading ? (
                    <Skeleton
                      variant="text"
                      width={150}
                      height={50}
                      sx={{ mx: "auto", my: 1 }}
                    />
                  ) : (
                    <Typography variant="h3" fontWeight={900} sx={{ my: 1 }}>
                      {yearProjection >= 0 ? "+" : ""}
                      {formatCurrency(yearProjection)}
                    </Typography>
                  )}
                  <Typography variant="body2" color="text.secondary">
                    Ganancia proyectada próximos 12 meses
                  </Typography>
                </Box>

                {/* Achievements */}
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    gutterBottom
                    display="block"
                  >
                    🏅 TUS LOGROS
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                    <Tooltip title="Primera Propiedad">
                      <Chip label="🏠" size="small" sx={{ fontSize: 18 }} />
                    </Tooltip>
                    {ytdCashflow > 0 && (
                      <Tooltip title="Año Rentable">
                        <Chip label="📈" size="small" sx={{ fontSize: 18 }} />
                      </Tooltip>
                    )}
                    {properties.length >= 3 && (
                      <Tooltip title="Portfolio Pro (3+ propiedades)">
                        <Chip label="👑" size="small" sx={{ fontSize: 18 }} />
                      </Tooltip>
                    )}
                  </Stack>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Smart Trend Alert */}
      {properties.length > 0 && !loading && (
        <Box sx={{ mb: 4 }}>
          {cashflowTrend === "up" && (
            <Alert
              severity="success"
              sx={{ display: "flex", alignItems: "flex-start" }}
            >
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, mb: 0.5 }}
                >
                  🚀 ¡Excelente! Tu cashflow ha mejorado
                </Typography>
                <Typography variant="body2">
                  Comparado al mes anterior, tu flujo de caja ha mostrado una
                  tendencia positiva. Mantén el enfoque en maximizar tus
                  ingresos por renta y optimizar tus gastos operacionales.
                </Typography>
              </Box>
            </Alert>
          )}
          {cashflowTrend === "down" && worstProperty && (
            <Alert
              severity="warning"
              sx={{ display: "flex", alignItems: "flex-start" }}
            >
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, mb: 0.5 }}
                >
                  ⚠️ Tu cashflow ha bajado
                </Typography>
                <Typography variant="body2">
                  Comparado al mes anterior, detectamos una reducción en tu
                  flujo de caja. {worstProperty.address} es tu propiedad con
                  peor desempeño ({formatCurrency(worstPropertyCashflow)}/mes).
                  Revisa los gastos asociados.
                </Typography>
              </Box>
            </Alert>
          )}
        </Box>
      )}

      {/* SECTION 4: CHART + FINANCIAL BREAKDOWN */}
      {properties.length > 0 && (
        <Grid container spacing={2}>
          {/* Monthly Evolution Chart */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                  📈 Evolución mensual del flujo de caja
                </Typography>

                <Paper
                  sx={{
                    position: "relative",
                    width: "100%",
                    height: 400,
                  }}
                >
                  {loading || chartData.length === 0 ? (
                    <Box
                      sx={{
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CircularProgress />
                    </Box>
                  ) : (
                    <Line
                      data={{
                        labels: chartData.map((d) => d.month),
                        datasets: [
                          {
                            label: "Ingresos",
                            data: chartData.map((d) => d.ingresos),
                            borderColor: "#4caf50",
                            backgroundColor: "rgba(76, 175, 80, 0.1)",
                            fill: true,
                            tension: 0.4,
                            borderWidth: 3,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            pointBackgroundColor: "#4caf50",
                          },
                          {
                            label: "Gastos",
                            data: chartData.map((d) => d.gastos),
                            borderColor: "#ff9800",
                            backgroundColor: "rgba(255, 152, 0, 0.1)",
                            fill: true,
                            tension: 0.4,
                            borderWidth: 3,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            pointBackgroundColor: "#ff9800",
                          },
                          {
                            label: "Flujo Neto",
                            data: chartData.map((d) => d.flujoNeto),
                            borderColor: "#2196f3",
                            backgroundColor: "rgba(33, 150, 243, 0.1)",
                            fill: true,
                            tension: 0.4,
                            borderWidth: 3,
                            pointRadius: 5,
                            pointHoverRadius: 7,
                            pointBackgroundColor: "#2196f3",
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                          mode: "index",
                          intersect: false,
                        },
                        plugins: {
                          legend: {
                            display: true,
                            position: "top",
                            labels: {
                              usePointStyle: true,
                              padding: 20,
                              font: {
                                size: 12,
                                weight: "600" as any,
                              },
                            },
                          },
                          tooltip: {
                            enabled: true,
                            backgroundColor: theme.palette.background.paper,
                            titleColor: theme.palette.text.primary,
                            bodyColor: theme.palette.text.secondary,
                            borderColor: theme.palette.divider,
                            borderWidth: 1,
                            padding: 12,
                            displayColors: true,
                            callbacks: {
                              label: (context) => {
                                return `${context.dataset.label}: ${formatCurrency(
                                  context.parsed.y ?? 0,
                                )}`;
                              },
                            },
                          },
                        },
                        scales: {
                          x: {
                            grid: {
                              display: false,
                            },
                            ticks: {
                              color: theme.palette.text.secondary,
                              font: {
                                size: 11,
                              },
                            },
                          },
                          y: {
                            grid: {
                              color: alpha(theme.palette.divider, 0.2),
                            },
                            ticks: {
                              color: theme.palette.text.secondary,
                              callback: (value) =>
                                formatCurrency(value as number),
                              font: {
                                size: 11,
                              },
                            },
                          },
                        },
                      }}
                    />
                  )}
                </Paper>
              </CardContent>
            </Card>
          </Grid>

          {/* Financial Summary */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                  💰 Resumen financiero
                </Typography>

                <Stack spacing={2}>
                  {/* Income */}
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Ingresos totales
                    </Typography>
                    {loading ? (
                      <Skeleton variant="text" width={120} />
                    ) : (
                      <Typography
                        variant="h6"
                        fontWeight={900}
                        color="success.main"
                      >
                        +{formatCurrency(totalIncome)}
                      </Typography>
                    )}
                    <Typography variant="caption">/año</Typography>
                  </Box>

                  <Divider />

                  {/* Expenses */}
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Gastos totales
                    </Typography>
                    {loading ? (
                      <Skeleton variant="text" width={120} />
                    ) : (
                      <Typography
                        variant="h6"
                        fontWeight={900}
                        color="error.main"
                      >
                        -
                        {formatCurrency(
                          totalRecurringExpenses + totalOneOffExpenses,
                        )}
                      </Typography>
                    )}
                    <Typography variant="caption">/año</Typography>
                  </Box>

                  <Divider />

                  {/* Loans */}
                  {totalPrincipal > 0 && (
                    <>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Hipotecas
                        </Typography>
                        {loading ? (
                          <Skeleton variant="text" width={120} />
                        ) : (
                          <Typography variant="h6" fontWeight={900}>
                            -
                            {formatCurrency(
                              ((totalPrincipal *
                                (0.04 / 12) *
                                Math.pow(1 + 0.04 / 12, 360)) /
                                (Math.pow(1 + 0.04 / 12, 360) - 1)) *
                                12,
                            )}
                          </Typography>
                        )}
                        <Typography variant="caption">/año</Typography>
                      </Box>

                      <Divider />
                    </>
                  )}

                  {/* Net Cashflow */}
                  <Box
                    sx={{
                      p: 2,
                      bgcolor:
                        ytdCashflow > 0 ? "success.light" : "error.light",
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      CASHFLOW NETO
                    </Typography>
                    {loading ? (
                      <Skeleton variant="text" width={140} />
                    ) : (
                      <Typography
                        variant="h5"
                        fontWeight={900}
                        color={ytdCashflow > 0 ? "success.dark" : "error.dark"}
                      >
                        {ytdCashflow >= 0 ? "+" : ""}
                        {formatCurrency(ytdCashflow)}
                      </Typography>
                    )}
                    <Typography variant="caption">/año</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Achievements & Milestones */}
      {properties.length > 0 && !loading && (
        <Box sx={{ mt: 4 }}>
          <AchievementBadges
            properties={properties}
            ytdCashflow={ytdCashflow}
            loading={loading}
          />
        </Box>
      )}
    </Box>
  );
}
