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
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import BuildIcon from "@mui/icons-material/Build";

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
import {
  getProperties,
  getLeases,
  getLoans,
  getRecurringExpenses,
  getOneOffExpenses,
  getRooms,
} from "@/modules/properties/api";
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
  // other fields exist but we don't need them here
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
    { month: string; ingresos: number; gastos: number; deuda: number }[]
  >([]);
  const [avgCashOnCash, setAvgCashOnCash] = useState(0);
  const [avgCapRate, setAvgCapRate] = useState(0);
  const [totalEquity, setTotalEquity] = useState(0);
  const [portfolioDebtRatio, setPortfolioDebtRatio] = useState<number>(0);
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
        return;
      }

      setLoading(true);
      try {
        const props = await getProperties(userDoc.orgId);
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
          return;
        }

        // --- Fetch all per-property data in parallel ---

        const leasesEntries = await Promise.all(
          filteredProps.map(async (prop) => {
            const leases = await getLeases(prop.id);
            return [prop.id, leases || []] as const;
          })
        );

        const loansEntries = await Promise.all(
          filteredProps.map(async (prop) => {
            const loans = await getLoans(prop.id);
            return [prop.id, loans || []] as const;
          })
        );

        const recurringEntries = await Promise.all(
          filteredProps.map(async (prop) => {
            const rec = await getRecurringExpenses(prop.id);
            return [prop.id, rec || []] as const;
          })
        );

        const oneOffEntries = await Promise.all(
          filteredProps.map(async (prop) => {
            const capex = await getOneOffExpenses(prop.id);
            return [prop.id, (capex || []) as OneOffExpense[]] as const;
          })
        );

        const roomsEntries = await Promise.all(
          filteredProps
            .filter((prop) => prop.rentalMode === "PER_ROOM")
            .map(async (prop) => {
              const rooms = await getRooms(prop.id);
              return [prop.id, rooms || []] as const;
            })
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

        const monthlyData: Record<
          number,
          { ingresos: number; gastos: number; deuda: number }
        > = {};
        for (let i = 1; i <= 12; i++) {
          monthlyData[i] = { ingresos: 0, gastos: 0, deuda: 0 };
        }

        const currentYear = new Date().getFullYear();

        for (const prop of filteredProps) {
          const leases = leasesByProp[prop.id] || [];
          const lease = leases[0];

          const loans = loansByProp[prop.id] || [];
          const loan = loans[0];

          const rooms = roomsByProp[prop.id] || [];

          // Debt ratio: always based on loan + current value, even if no lease
          if (loan) {
            totalPrincipal += loan.principal;
          }

          totalCurrentValue +=
            typeof prop.currentValue === "number" && prop.currentValue > 0
              ? prop.currentValue
              : prop.purchasePrice;

          // If no lease and not PER_ROOM with rooms, skip the rest of metrics for this property
          const hasLease = !!lease;
          const hasRoomsForPerRoom = prop.rentalMode === "PER_ROOM" && rooms.length > 0;
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
            const monthDate = dayjs().year(currentYear).month(i - 1);
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
            monthlyData[i].gastos += monthlyExpenses;
            monthlyData[i].deuda += monthlyDebt;
          }

          oneOffExpenses
            .filter((exp) => new Date(exp.date).getFullYear() === currentYear)
            .forEach((exp) => {
              const expMonth = new Date(exp.date).getMonth() + 1;
              monthlyData[expMonth].gastos += exp.amount;
            });
        }

        setTotalCFAF(cfaf);
        setTotalIncome(annualIncome);
        setTotalRecurringExpenses(annualRecurringExpenses);
        setTotalOneOffExpenses(annualOneOffExpenses);
        setTotalEquity(totalEquitySum);

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

  const ingresosTotales = chartData.reduce((sum, d) => sum + d.ingresos, 0);
  const gastosTotales = chartData.reduce((sum, d) => sum + d.gastos, 0);
  const deudaTotal = chartData.reduce((sum, d) => sum + d.deuda, 0);

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Dashboard
        </Typography>
        <FormControl sx={{ minWidth: { xs: 150, sm: 250 } }}>
          <InputLabel>Vivienda</InputLabel>
          <Select
            value={selectedPropertyId}
            label="Vivienda"
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            size="medium"
            disabled={loading}
          >
            <MenuItem value="all">Todas las viviendas</MenuItem>
            {properties.map((prop) => (
              <MenuItem key={prop.id} value={prop.id}>
                {prop.address}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Grid container spacing={{ xs: 2, sm: 3 }} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: "100%",
              background: alpha(theme.palette.primary.main, 0.03),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  mb: { xs: 2, sm: 3 },
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: { xs: 40, sm: 48 },
                    height: { xs: 40, sm: 48 },
                    borderRadius: "8px",
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    mr: 2,
                  }}
                >
                  <HomeWorkIcon sx={{ fontSize: { xs: 24, sm: 28 } }} />
                </Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    fontSize: { xs: "1rem", sm: "1.25rem" },
                  }}
                >
                  Resumen General
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 500, display: "block", mb: 0.5 }}
                  >
                    {selectedPropertyId === "all"
                      ? "Total Viviendas"
                      : "Vivienda"}
                  </Typography>
                  {loading ? (
                    <Skeleton variant="text" width={60} height={30} />
                  ) : (
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 700,
                        color: theme.palette.primary.main,
                      }}
                    >
                      {selectedPropertyId === "all" ? properties.length : 1}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 500, display: "block", mb: 0.5 }}
                  >
                    Ingresos Anuales
                  </Typography>
                  {loading ? (
                    <Skeleton variant="text" width={120} height={30} />
                  ) : (
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 700,
                        color: "#4caf50",
                        fontSize: { xs: "1.25rem", sm: "1.5rem" },
                      }}
                    >
                      {formatCurrency(totalIncome)}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 500, display: "block", mb: 0.5 }}
                  >
                    Cash Flow Anual
                  </Typography>
                  {loading ? (
                    <Skeleton variant="text" width={120} height={30} />
                  ) : (
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 700,
                        color: totalCFAF > 0 ? "#4caf50" : "#f44336",
                        fontSize: { xs: "1.25rem", sm: "1.5rem" },
                      }}
                    >
                      {formatCurrency(totalCFAF)}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 500, display: "block", mb: 0.5 }}
                  >
                    Ratio Endeudamiento
                  </Typography>
                  {loading ? (
                    <Skeleton variant="text" width={80} height={30} />
                  ) : (
                    <Typography
                      variant="h5"
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
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: "100%",
              background: alpha("#ff9800", 0.03),
              border: `1px solid ${alpha("#ff9800", 0.15)}`,
            }}
          >
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  mb: { xs: 2, sm: 3 },
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: { xs: 40, sm: 48 },
                    height: { xs: 40, sm: 48 },
                    borderRadius: "8px",
                    bgcolor: alpha("#ff9800", 0.1),
                    color: "#ff9800",
                    mr: 2,
                  }}
                >
                  <BuildIcon sx={{ fontSize: { xs: 24, sm: 28 } }} />
                </Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    fontSize: { xs: "1rem", sm: "1.25rem" },
                  }}
                >
                  Gastos Anuales
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 500, display: "block", mb: 0.5 }}
                  >
                    Total Gastos
                  </Typography>
                  {loading ? (
                    <Skeleton variant="text" width={120} height={30} />
                  ) : (
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 700,
                        color: "#ff9800",
                        fontSize: { xs: "1.25rem", sm: "1.5rem" },
                      }}
                    >
                      {formatCurrency(
                        totalRecurringExpenses + totalOneOffExpenses
                      )}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 500, display: "block", mb: 0.5 }}
                  >
                    Gastos Fijos
                  </Typography>
                  {loading ? (
                    <Skeleton variant="text" width={120} height={30} />
                  ) : (
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 700,
                        color: alpha("#ff9800", 0.8),
                        fontSize: { xs: "1.25rem", sm: "1.5rem" },
                      }}
                    >
                      {formatCurrency(totalRecurringExpenses)}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 500, display: "block", mb: 0.5 }}
                  >
                    Mantenimiento
                  </Typography>
                  {loading ? (
                    <Skeleton variant="text" width={120} height={30} />
                  ) : (
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 700,
                        color: alpha("#ff9800", 0.8),
                        fontSize: { xs: "1.25rem", sm: "1.5rem" },
                      }}
                    >
                      {formatCurrency(totalOneOffExpenses)}
                    </Typography>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={{ xs: 2, sm: 3 }}>
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ fontWeight: 600, mb: { xs: 2, sm: 3 } }}
            >
              Flujo de Caja Consolidado (12 meses)
            </Typography>

            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={4}>
                <Box
                  sx={{
                    textAlign: "center",
                    p: 1.5,
                    bgcolor: "rgba(76, 175, 80, 0.08)",
                    borderRadius: 1,
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                  >
                    Ingresos Totales
                  </Typography>
                  {loading ? (
                    <Skeleton variant="text" width={120} height={30} />
                  ) : (
                    <Typography variant="h6" fontWeight="bold" color="#4caf50">
                      {formatCurrency(ingresosTotales)}
                    </Typography>
                  )}
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box
                  sx={{
                    textAlign: "center",
                    p: 1.5,
                    bgcolor: "rgba(255, 152, 0, 0.08)",
                    borderRadius: 1,
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                  >
                    Gastos Totales
                  </Typography>
                  {loading ? (
                    <Skeleton variant="text" width={120} height={30} />
                  ) : (
                    <Typography variant="h6" fontWeight="bold" color="#ff9800">
                      {formatCurrency(gastosTotales)}
                    </Typography>
                  )}
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box
                  sx={{
                    textAlign: "center",
                    p: 1.5,
                    bgcolor: "rgba(244, 67, 54, 0.08)",
                    borderRadius: 1,
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    display="block"
                  >
                    Deuda Pagada
                  </Typography>
                  {loading ? (
                    <Skeleton variant="text" width={120} height={30} />
                  ) : (
                    <Typography variant="h6" fontWeight="bold" color="#f44336">
                      {formatCurrency(deudaTotal)}
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>

            <Box sx={{ height: { xs: 200, sm: 280 } }}>
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
                        borderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: "#4caf50",
                      },
                      {
                        label: "Gastos",
                        data: chartData.map((d) => d.gastos),
                        borderColor: "#ff9800",
                        backgroundColor: "rgba(255, 152, 0, 0.1)",
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: "#ff9800",
                      },
                      {
                        label: "Deuda",
                        data: chartData.map((d) => d.deuda),
                        borderColor: "#f44336",
                        backgroundColor: "rgba(244, 67, 54, 0.1)",
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointBackgroundColor: "#f44336",
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
                          padding: 15,
                          font: {
                            size: 11,
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
                            size: 10,
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
                            size: 10,
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
          <Paper sx={{ p: { xs: 2, sm: 3 }, height: "100%" }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ fontWeight: 600, mb: { xs: 2, sm: 3 } }}
            >
              Resumen Financiero
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  gutterBottom
                >
                  Ingreso Mensual Promedio
                </Typography>
                {loading ? (
                  <Skeleton variant="text" width={140} height={30} />
                ) : (
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, color: "#4caf50" }}
                  >
                    {formatCurrency(totalIncome / 12 || 0)}
                  </Typography>
                )}
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  gutterBottom
                >
                  Gasto Mensual Promedio
                </Typography>
                {loading ? (
                  <Skeleton variant="text" width={140} height={30} />
                ) : (
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 700, color: "#ff9800" }}
                  >
                    {formatCurrency(
                      (totalRecurringExpenses + totalOneOffExpenses) / 12 || 0
                    )}
                  </Typography>
                )}
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  gutterBottom
                >
                  Cash Flow Mensual
                </Typography>
                {loading ? (
                  <Skeleton variant="text" width={140} height={30} />
                ) : (
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: totalCFAF > 0 ? "#4caf50" : "#f44336",
                    }}
                  >
                    {formatCurrency(totalCFAF / 12 || 0)}
                  </Typography>
                )}
              </Box>
              <Box
                sx={{
                  mt: 1,
                  pt: 2.5,
                  borderTop: `1px solid ${theme.palette.divider}`,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                  Rentabilidad
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      gutterBottom
                    >
                      Capital Invertido (Equity)
                    </Typography>
                    {loading ? (
                      <Skeleton variant="text" width={160} height={30} />
                    ) : (
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {formatCurrency(totalEquity)}
                      </Typography>
                    )}
                  </Box>
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      gutterBottom
                    >
                      Cash-on-Cash Return
                    </Typography>
                    {loading ? (
                      <Skeleton variant="text" width={100} height={30} />
                    ) : (
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 700, color: "#00bcd4" }}
                      >
                        {avgCashOnCash.toFixed(2)}%
                      </Typography>
                    )}
                  </Box>
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      gutterBottom
                    >
                      Cap Rate Neto
                    </Typography>
                    {loading ? (
                      <Skeleton variant="text" width={100} height={30} />
                    ) : (
                      <Typography
                        variant="h6"
                        sx={{ fontWeight: 700, color: "#3f51b5" }}
                      >
                        {avgCapRate.toFixed(2)}%
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
