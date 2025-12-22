import { useEffect, useState } from "react";
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
import ShowChartIcon from "@mui/icons-material/ShowChart";
import PaidIcon from "@mui/icons-material/Paid";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  ChartTooltip,
  ChartLegend
);

import dayjs from "dayjs";
import { useAuth } from "@/auth/authContext";
import { getDashboard } from "@/modules/properties/api";
import { Property, Room } from "@/modules/properties/types";
import {
  computeLeveredMetrics,
  sumClosingCosts,
} from "@/modules/properties/calculations";
import { getAggregatedRentForMonth } from "@/modules/properties/rentalAggregation";
import { formatCurrency } from "@/utils/format";

interface OneOffExpense {
  date: string;
  amount: number;
}

export function DashboardPage() {
  const { userDoc } = useAuth();
  const theme = useTheme();

  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");

  const [totalCFAF, setTotalCFAF] = useState(0);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalRecurringExpenses, setTotalRecurringExpenses] = useState(0);
  const [totalOneOffExpenses, setTotalOneOffExpenses] = useState(0);
  const [chartData, setChartData] = useState<
    { month: string; ingresos: number; gastos: number; flujoNeto: number }[]
  >([]);
  const [avgCashOnCash, setAvgCashOnCash] = useState(0);
  const [avgCapRate, setAvgCapRate] = useState(0);
  const [totalEquity, setTotalEquity] = useState(0);
  const [portfolioDebtRatio, setPortfolioDebtRatio] = useState<number>(0);
  const [totalPrincipal, setTotalPrincipal] = useState(0);
  const [totalCurrentValue, setTotalCurrentValue] = useState(0);
  const [totalPurchasePrice, setTotalPurchasePrice] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!userDoc?.orgId) {
        setProperties([]);
        setChartData([]);
        setTotalCFAF(0);
        setTotalIncome(0);
        setTotalRecurringExpenses(0);
        setTotalOneOffExpenses(0);
        setTotalEquity(0);
        setAvgCapRate(0);
        setAvgCashOnCash(0);
        setPortfolioDebtRatio(0);
        setTotalPrincipal(0);
        setTotalCurrentValue(0);
        setTotalPurchasePrice(0);
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
          setTotalCFAF(0);
          setTotalIncome(0);
          setTotalRecurringExpenses(0);
          setTotalOneOffExpenses(0);
          setTotalEquity(0);
          setAvgCapRate(0);
          setAvgCashOnCash(0);
          setPortfolioDebtRatio(0);
          setTotalPrincipal(0);
          setTotalCurrentValue(0);
          setTotalPurchasePrice(0);
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
            ] as const
        );
        const loansEntries = filteredProps.map(
          (prop) =>
            [prop.id, loansAll.filter((x) => x.propertyId === prop.id)] as const
        );
        const recurringEntries = filteredProps.map(
          (prop) =>
            [
              prop.id,
              recurringAll.filter((x) => x.propertyId === prop.id),
            ] as const
        );
        const oneOffEntries = filteredProps.map(
          (prop) =>
            [
              prop.id,
              oneOffAll.filter((x) => x.propertyId === prop.id),
            ] as const
        );
        const roomsEntries = filteredProps
          .filter((prop) => prop.rentalMode === "PER_ROOM")
          .map(
            (prop) =>
              [
                prop.id,
                roomsAll.filter((x) => x.propertyId === prop.id),
              ] as const
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
            monthlyRentForMetrics = lease.monthlyRent;
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
            yearlyRent = lease.monthlyRent * 12 * (1 - (lease.vacancyPct || 0));
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
              monthlyRent = lease.monthlyRent * (1 - (lease.vacancyPct || 0));
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
          monthlyData[m].flujoNeto = monthlyData[m].ingresos - monthlyData[m].gastos;
        });

        setTotalCFAF(cfaf);
        setTotalIncome(annualIncome);
        setTotalRecurringExpenses(annualRecurringExpenses);
        setTotalOneOffExpenses(annualOneOffExpenses);
        setTotalEquity(totalEquitySum);
        setTotalPrincipal(totalPrincipal);
        setTotalCurrentValue(totalCurrentValue);
        setTotalPurchasePrice(totalPurchasePrice);

        setPortfolioDebtRatio(
          totalCurrentValue > 0 ? (totalPrincipal / totalCurrentValue) * 100 : 0
        );

        if (totalEquitySum > 0) {
          setAvgCashOnCash(weightedCashOnCash / totalEquitySum);
          setAvgCapRate(weightedCapRate / totalEquitySum);
        } else {
          setAvgCashOnCash(0);
          setAvgCapRate(0);
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
          }))
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userDoc, selectedPropertyId]);

  // Calculate derived metrics
  const noi = totalIncome - totalRecurringExpenses - totalOneOffExpenses;
  const rentabilidadBruta = totalCurrentValue > 0 ? (totalIncome / totalCurrentValue) * 100 : 0;
  const rentabilidadNeta = totalCurrentValue > 0 ? (noi / totalCurrentValue) * 100 : 0;
  const plusvalia = totalCurrentValue - totalPurchasePrice;
  const plusvaliaPercent = totalPurchasePrice > 0 ? (plusvalia / totalPurchasePrice) * 100 : 0;

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

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 8 }}>
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
            Comienza añadiendo tu primera vivienda para ver aquí todas las métricas
            de rentabilidad y rendimiento de tu portfolio inmobiliario.
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

      {/* Hero Section - Métricas Principales */}
      {properties.length > 0 && (
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.9)} 0%, ${alpha(theme.palette.success.dark, 0.9)} 100%)`,
              color: "white",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                top: -20,
                right: -20,
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: alpha("#fff", 0.1),
              }}
            />
            <CardContent sx={{ position: "relative", zIndex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <PaidIcon sx={{ fontSize: 24, mr: 1 }} />
                <Typography variant="caption" sx={{ fontWeight: 600, opacity: 0.9 }}>
                  VALOR DEL PORTFOLIO
                </Typography>
              </Box>
              {loading ? (
                <Skeleton variant="text" width={140} height={40} sx={{ bgcolor: alpha("#fff", 0.2) }} />
              ) : (
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
                  {formatCurrency(totalCurrentValue)}
                </Typography>
              )}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Chip
                  size="small"
                  label={`${properties.length} ${properties.length === 1 ? "propiedad" : "propiedades"}`}
                  sx={{
                    bgcolor: alpha("#fff", 0.2),
                    color: "white",
                    fontWeight: 600,
                    fontSize: "0.7rem",
                  }}
                />
                {plusvalia !== 0 && (
                  <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 600 }}>
                    {plusvaliaPercent > 0 ? "+" : ""}{plusvaliaPercent.toFixed(1)}% plusvalía
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: `linear-gradient(135deg, ${alpha("#2196f3", 0.9)} 0%, ${alpha("#1976d2", 0.9)} 100%)`,
              color: "white",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                top: -20,
                right: -20,
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: alpha("#fff", 0.1),
              }}
            />
            <CardContent sx={{ position: "relative", zIndex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <TrendingUpIcon sx={{ fontSize: 24, mr: 1 }} />
                <Typography variant="caption" sx={{ fontWeight: 600, opacity: 0.9 }}>
                  INGRESOS ANUALES
                </Typography>
              </Box>
              {loading ? (
                <Skeleton variant="text" width={140} height={40} sx={{ bgcolor: alpha("#fff", 0.2) }} />
              ) : (
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
                  {formatCurrency(totalIncome)}
                </Typography>
              )}
              <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 600 }}>
                {formatCurrency(totalIncome / 12)} mensuales
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: `linear-gradient(135deg, ${alpha("#ff9800", 0.9)} 0%, ${alpha("#f57c00", 0.9)} 100%)`,
              color: "white",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                top: -20,
                right: -20,
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: alpha("#fff", 0.1),
              }}
            />
            <CardContent sx={{ position: "relative", zIndex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <ShowChartIcon sx={{ fontSize: 24, mr: 1 }} />
                <Typography variant="caption" sx={{ fontWeight: 600, opacity: 0.9 }}>
                  FLUJO DE CAJA ANUAL
                </Typography>
              </Box>
              {loading ? (
                <Skeleton variant="text" width={140} height={40} sx={{ bgcolor: alpha("#fff", 0.2) }} />
              ) : (
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
                  {formatCurrency(totalCFAF)}
                </Typography>
              )}
              <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 600 }}>
                {formatCurrency(totalCFAF / 12)} mensuales
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{
              background: `linear-gradient(135deg, ${alpha("#9c27b0", 0.9)} 0%, ${alpha("#7b1fa2", 0.9)} 100%)`,
              color: "white",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                position: "absolute",
                top: -20,
                right: -20,
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: alpha("#fff", 0.1),
              }}
            />
            <CardContent sx={{ position: "relative", zIndex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                <AccountBalanceWalletIcon sx={{ fontSize: 24, mr: 1 }} />
                <Typography variant="caption" sx={{ fontWeight: 600, opacity: 0.9 }}>
                  BENEFICIO NETO (NOI)
                </Typography>
              </Box>
              {loading ? (
                <Skeleton variant="text" width={140} height={40} sx={{ bgcolor: alpha("#fff", 0.2) }} />
              ) : (
                <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
                  {formatCurrency(noi)}
                </Typography>
              )}
              <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 600 }}>
                {rentabilidadNeta.toFixed(2)}% rentabilidad neta
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      )}

      {/* Métricas de Rentabilidad */}
      {properties.length > 0 && (
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
          Métricas de Rentabilidad
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Tasa de Capitalización
              </Typography>
              {loading ? (
                <Skeleton variant="text" width={100} height={40} />
              ) : (
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: "#2196f3" }}>
                    {avgCapRate.toFixed(2)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Cap Rate
                  </Typography>
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                Retorno sobre la inversión inicial
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Retorno sobre Capital
              </Typography>
              {loading ? (
                <Skeleton variant="text" width={100} height={40} />
              ) : (
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: "#00bcd4" }}>
                    {avgCashOnCash.toFixed(2)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    CoC
                  </Typography>
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                Rendimiento del capital invertido
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Rentabilidad Bruta
              </Typography>
              {loading ? (
                <Skeleton variant="text" width={100} height={40} />
              ) : (
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, color: "#4caf50" }}>
                    {rentabilidadBruta.toFixed(2)}%
                  </Typography>
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                Ingresos / Valor actual
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Ratio de Endeudamiento
              </Typography>
              {loading ? (
                <Skeleton variant="text" width={100} height={40} />
              ) : (
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 700,
                      color:
                        portfolioDebtRatio < 50
                          ? "#4caf50"
                          : portfolioDebtRatio < 70
                            ? "#ff9800"
                            : "#f44336",
                    }}
                  >
                    {portfolioDebtRatio.toFixed(1)}%
                  </Typography>
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                {formatCurrency(totalPrincipal)} deuda total
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      )}

      {/* Gráficos */}
      {properties.length > 0 && (
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
              Evolución Mensual del Flujo de Caja
            </Typography>

            <Box sx={{ height: 350 }}>
              {loading ? (
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
                            weight: 600,
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
                              context.parsed.y ?? 0
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
                          callback: (value) => formatCurrency(value as number),
                          font: {
                            size: 11,
                          },
                        },
                      },
                    },
                  }}
                />
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3, height: "100%" }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
              Desglose Financiero
            </Typography>

            <Box sx={{ mb: 4 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Capital Invertido
              </Typography>
              {loading ? (
                <Skeleton variant="text" width={160} height={35} />
              ) : (
                <Typography variant="h5" sx={{ fontWeight: 700, color: "#2196f3" }}>
                  {formatCurrency(totalEquity)}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Ingresos
                  </Typography>
                  {loading ? (
                    <Skeleton variant="text" width={100} />
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 700, color: "#4caf50" }}>
                      {formatCurrency(totalIncome)}
                    </Typography>
                  )}
                </Box>
                <Box
                  sx={{
                    height: 8,
                    bgcolor: alpha("#4caf50", 0.2),
                    borderRadius: 1,
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      height: "100%",
                      width: "100%",
                      bgcolor: "#4caf50",
                    }}
                  />
                </Box>
              </Box>

              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Gastos Totales
                  </Typography>
                  {loading ? (
                    <Skeleton variant="text" width={100} />
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 700, color: "#ff9800" }}>
                      {formatCurrency(totalRecurringExpenses + totalOneOffExpenses)}
                    </Typography>
                  )}
                </Box>
                <Box
                  sx={{
                    height: 8,
                    bgcolor: alpha("#ff9800", 0.2),
                    borderRadius: 1,
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      height: "100%",
                      width: totalIncome > 0 ? `${((totalRecurringExpenses + totalOneOffExpenses) / totalIncome) * 100}%` : "0%",
                      bgcolor: "#ff9800",
                    }}
                  />
                </Box>
              </Box>

              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Beneficio Neto (NOI)
                  </Typography>
                  {loading ? (
                    <Skeleton variant="text" width={100} />
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 700, color: "#9c27b0" }}>
                      {formatCurrency(noi)}
                    </Typography>
                  )}
                </Box>
                <Box
                  sx={{
                    height: 8,
                    bgcolor: alpha("#9c27b0", 0.2),
                    borderRadius: 1,
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      height: "100%",
                      width: totalIncome > 0 ? `${(noi / totalIncome) * 100}%` : "0%",
                      bgcolor: "#9c27b0",
                    }}
                  />
                </Box>
              </Box>

              <Box sx={{ pt: 2, borderTop: `2px solid ${theme.palette.divider}` }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Margen de Beneficio
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: noi > 0 ? "#4caf50" : "#f44336" }}>
                  {totalIncome > 0 ? ((noi / totalIncome) * 100).toFixed(1) : "0.0"}%
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
      )}
    </Box>
  );
}
