import { useEffect, useMemo, useState, useRef } from "react";
import {
  Box,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  ToggleButtonGroup,
  ToggleButton,
  Stack,
  Card,
  CardContent,
  Divider,
  Skeleton,
  CircularProgress,
  Button,
} from "@mui/material";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip as ChartTooltip,
  Legend as ChartLegend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import dayjs from "dayjs";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ChartTooltip,
  ChartLegend
);

import { useAuth } from "@/auth/authContext";
import {
  getProperties,
  getLeases,
  getLoans,
  getRecurringExpenses,
  getOneOffExpenses,
  getRooms,
} from "@/modules/properties/api";
import {
  Property,
  Lease,
  Loan,
  RecurringExpense,
  Room,
} from "@/modules/properties/types";
import {
  computeLeveredMetrics,
  sumClosingCosts,
} from "@/modules/properties/calculations";
import { getAggregatedRentForMonth } from "@/modules/properties/rentalAggregation";
import { Money } from "@/components/Money";
import { formatCurrency } from "@/utils/format";

type ViewMode = "monthly" | "yearly";

interface CashflowRow {
  period: string;
  rentIncome: number;
  recurringExpenses: number;
  oneOffExpenses: number;
  debtPayment: number;
  debtInterest: number;
  debtPrincipal: number;
  noi: number;
  netCashflow: number;
}

interface OneOffExpense {
  id: string;
  propertyId: string;
  date: string;
  amount: number;
}

type LeasesByProp = Record<string, Lease[]>;
type RecurringByProp = Record<string, RecurringExpense[]>;
type OneOffByProp = Record<string, OneOffExpense[]>;
type LoansByProp = Record<string, Loan[]>;

export function CashflowPage() {
  const { userDoc } = useAuth();

  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");

  const [leasesByProp, setLeasesByProp] = useState<LeasesByProp>({});
  const [recurringByProp, setRecurringByProp] = useState<RecurringByProp>({});
  const [oneOffByProp, setOneOffByProp] = useState<OneOffByProp>({});
  const [loansByProp, setLoansByProp] = useState<LoansByProp>({});
  const [roomsByProp, setRoomsByProp] = useState<Record<string, Room[]>>({});
  const [dataLoaded, setDataLoaded] = useState(false);

  const [monthlyData, setMonthlyData] = useState<CashflowRow[]>([]);
  const [yearlyData, setYearlyData] = useState<CashflowRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Cache for computed data: key = `${selectedPropertyId}:${viewMode}`
  const cacheRef = useRef<Record<string, CashflowRow[]>>({});

  // Incremental rendering for performance
  const [visibleCount, setVisibleCount] = useState(6);

  // 1) Load properties
  useEffect(() => {
    const loadProperties = async () => {
      if (!userDoc?.orgId) return;
      setLoading(true);
      try {
        const props = await getProperties(userDoc.orgId);
        setProperties(props);
        // Clear cache when properties change
        cacheRef.current = {};
      } finally {
        setLoading(false);
      }
    };
    loadProperties();
  }, [userDoc]);

  // 2) Load all per-property data ONCE (leases, recurring, one-off, loans)
  useEffect(() => {
    const loadPerPropertyData = async () => {
      if (!userDoc?.orgId || properties.length === 0) {
        setLeasesByProp({});
        setRecurringByProp({});
        setOneOffByProp({});
        setLoansByProp({});
        setDataLoaded(false);
        return;
      }

      setLoading(true);
      setDataLoaded(false);

      try {
        const leaseEntries = await Promise.all(
          properties.map(async (prop) => {
            const leases = await getLeases(prop.id);
            return [prop.id, leases || []] as const;
          })
        );

        const recurringEntries = await Promise.all(
          properties.map(async (prop) => {
            const rec = await getRecurringExpenses(prop.id);
            return [prop.id, rec || []] as const;
          })
        );

        const oneOffEntries = await Promise.all(
          properties.map(async (prop) => {
            const capex = await getOneOffExpenses(prop.id);
            return [prop.id, capex || []] as const;
          })
        );

        const loanEntries = await Promise.all(
          properties.map(async (prop) => {
            const loans = await getLoans(prop.id);
            return [prop.id, loans || []] as const;
          })
        );

        const roomEntries = await Promise.all(
          properties
            .filter((prop) => prop.rentalMode === "PER_ROOM")
            .map(async (prop) => {
              const rooms = await getRooms(prop.id);
              return [prop.id, rooms || []] as const;
            })
        );

        const leasesMap: LeasesByProp = {};
        leaseEntries.forEach(([id, leases]) => {
          leasesMap[id] = leases;
        });

        const recurringMap: RecurringByProp = {};
        recurringEntries.forEach(([id, rec]) => {
          recurringMap[id] = rec;
        });

        const oneOffMap: OneOffByProp = {};
        oneOffEntries.forEach(([id, capex]) => {
          oneOffMap[id] = capex as OneOffExpense[];
        });

        const loansMap: LoansByProp = {};
        loanEntries.forEach(([id, loans]) => {
          loansMap[id] = loans;
        });

        const roomsMap: Record<string, Room[]> = {};
        roomEntries.forEach(([id, rooms]) => {
          roomsMap[id] = rooms;
        });

        setLeasesByProp(leasesMap);
        setRecurringByProp(recurringMap);
        setOneOffByProp(oneOffMap);
        setLoansByProp(loansMap);
        setRoomsByProp(roomsMap);
        setDataLoaded(true);
      } finally {
        setLoading(false);
      }
    };

    loadPerPropertyData();
  }, [userDoc, properties]);

  // Helper to pick which properties to process
  const propsToProcess = useMemo(
    () =>
      selectedPropertyId === "all"
        ? properties
        : properties.filter((p) => p.id === selectedPropertyId),
    [properties, selectedPropertyId]
  );

  // 3) Compute monthly & yearly data with caching
  useEffect(() => {
    if (!dataLoaded || propsToProcess.length === 0) {
      setMonthlyData([]);
      setYearlyData([]);
      setVisibleCount(6); // Reset incremental rendering
      return;
    }

    const cacheKey = `${selectedPropertyId}:${viewMode}`;
    const cachedData = cacheRef.current[cacheKey];

    if (cachedData) {
      // Use cached data
      if (viewMode === "monthly") {
        setMonthlyData(cachedData);
      } else {
        setYearlyData(cachedData);
      }
      setLoading(false);
      setVisibleCount(6); // Reset for new data
      return;
    }

    setLoading(true);
    const currentYear = dayjs().year();

    const computeMonthCashflow = (monthDate: dayjs.Dayjs): CashflowRow => {
      const period = monthDate.format("MMM YYYY");
      let rentIncome = 0;
      let recurringExpenses = 0;
      let oneOffExpenses = 0;
      let debtPayment = 0;
      let debtInterest = 0;
      let debtPrincipal = 0;

      for (const prop of propsToProcess) {
        const leases = leasesByProp[prop.id] || [];
        const rooms = roomsByProp[prop.id] || [];

        // Skip if no leases and not PER_ROOM with rooms
        const hasLease = leases.length > 0;
        const hasRoomsForPerRoom = prop.rentalMode === "PER_ROOM" && rooms.length > 0;
        if (!hasLease && !hasRoomsForPerRoom) continue;

        // Calculate rent income
        if (prop.rentalMode === "PER_ROOM" && rooms.length > 0) {
          const agg = getAggregatedRentForMonth({
            property: prop,
            leases,
            rooms,
            monthDate,
          });
          rentIncome += agg.monthlyNet;
        } else if (hasLease) {
          // ENTIRE_UNIT logic
          const activeLease = leases.find((l) => {
            if (!l || !l.startDate) return false;
            const ls = dayjs(l.startDate);
            const le = l.endDate ? dayjs(l.endDate) : null;

            const startsOnOrBefore =
              monthDate.isSame(ls, "month") || monthDate.isAfter(ls, "month");
            const endsOnOrAfter =
              !le ||
              monthDate.isBefore(le, "month") ||
              monthDate.isSame(le, "month");

            return startsOnOrBefore && endsOnOrAfter;
          });

          if (activeLease) {
            rentIncome +=
              activeLease.monthlyRent * (1 - (activeLease.vacancyPct || 0));
          }
        }

        // Recurring expenses
        const recurring = recurringByProp[prop.id] || [];
        for (const exp of recurring) {
          if (exp.periodicity === "monthly") {
            recurringExpenses += exp.amount;
          } else if (exp.periodicity === "quarterly") {
            if ([0, 3, 6, 9].includes(monthDate.month())) {
              recurringExpenses += exp.amount;
            }
          } else if (exp.periodicity === "yearly") {
            if (exp.nextDueDate) {
              const dueDate = dayjs(exp.nextDueDate);
              if (monthDate.isSame(dueDate, "month")) {
                recurringExpenses += exp.amount;
              }
            }
          }
        }

        // One-off expenses (CapEx)
        const capex = oneOffByProp[prop.id] || [];
        for (const exp of capex) {
          const expDate = dayjs(exp.date);
          if (
            monthDate.isSame(expDate, "month") &&
            monthDate.isSame(expDate, "year")
          ) {
            oneOffExpenses += exp.amount;
          }
        }

        // Debt
        const loans = loansByProp[prop.id] || [];
        const loan = loans.length > 0 ? loans[0] : null;

        if (loan) {
          const loanStart = loan.startDate
            ? dayjs(loan.startDate)
            : dayjs(monthDate);
          const monthsSinceLoanStart = monthDate.diff(loanStart, "month");

          if (
            monthsSinceLoanStart >= 0 &&
            monthsSinceLoanStart < loan.termMonths
          ) {
            const recurring = recurringByProp[prop.id] || [];

            // Calculate monthly rent for metrics
            let monthlyRentForMetrics = 0;
            let vacancyPctForMetrics = 0;

            if (prop.rentalMode === "PER_ROOM" && rooms.length > 0) {
              const agg = getAggregatedRentForMonth({
                property: prop,
                leases,
                rooms,
                monthDate,
              });
              monthlyRentForMetrics = agg.monthlyGross;
              vacancyPctForMetrics = agg.effectiveVacancyPct;
            } else {
              const activeLease = leases.find((l) => {
                if (!l || !l.startDate) return false;
                const ls = dayjs(l.startDate);
                const le = l.endDate ? dayjs(l.endDate) : null;
                const startsOnOrBefore =
                  monthDate.isSame(ls, "month") || monthDate.isAfter(ls, "month");
                const endsOnOrAfter =
                  !le ||
                  monthDate.isBefore(le, "month") ||
                  monthDate.isSame(le, "month");
                return startsOnOrBefore && endsOnOrAfter;
              });
              if (activeLease) {
                monthlyRentForMetrics = activeLease.monthlyRent;
                vacancyPctForMetrics = activeLease.vacancyPct || 0;
              }
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

            debtPayment += metrics.ads / 12;
            debtInterest += metrics.interestsAnnual / 12;
            debtPrincipal += metrics.principalAnnual / 12;
          }
        }
      }

      const noi = rentIncome - recurringExpenses - oneOffExpenses;
      const netCashflow = noi - debtPayment;

      return {
        period,
        rentIncome,
        recurringExpenses,
        oneOffExpenses,
        debtPayment,
        debtInterest,
        debtPrincipal,
        noi,
        netCashflow,
      };
    };

    const computeYearCashflow = (year: number): CashflowRow => {
      const period = `${year}`;
      let rentIncome = 0;
      let recurringExpenses = 0;
      let oneOffExpenses = 0;
      let debtPayment = 0;
      let debtInterest = 0;
      let debtPrincipal = 0;

      const yearStart = dayjs(`${year}-01-01`);
      const yearEnd = dayjs(`${year}-12-31`);

      for (const prop of propsToProcess) {
        const leases = leasesByProp[prop.id] || [];
        if (!leases.length) continue;

        const leaseFallback = leases[0];
        const activeLease =
          leases.find((l) => {
            if (!l || !l.startDate) return false;
            const ls = dayjs(l.startDate);
            const le = l.endDate ? dayjs(l.endDate) : null;
            const startsOnOrBeforeYearEnd =
              ls.isSame(yearEnd, "day") || ls.isBefore(yearEnd, "day");
            const endsOnOrAfterYearStart =
              !le ||
              le.isSame(yearStart, "day") ||
              le.isAfter(yearStart, "day");
            return startsOnOrBeforeYearEnd && endsOnOrAfterYearStart;
          }) || leaseFallback;

        // Annual rent
        const rooms = roomsByProp[prop.id] || [];
        if (prop.rentalMode === "PER_ROOM" && rooms.length > 0) {
          for (let month = 1; month <= 12; month++) {
            const monthDate = dayjs(`${year}-${month.toString().padStart(2, "0")}-01`);
            const agg = getAggregatedRentForMonth({
              property: prop,
              leases,
              rooms,
              monthDate,
            });
            rentIncome += agg.monthlyGross;
          }
        } else {
          rentIncome +=
            activeLease.monthlyRent * 12 * (1 - (activeLease.vacancyPct || 0));
        }

        // Recurring expenses
        const recurring = recurringByProp[prop.id] || [];
        for (const exp of recurring) {
          if (exp.periodicity === "monthly") {
            recurringExpenses += exp.amount * 12;
          } else if (exp.periodicity === "quarterly") {
            recurringExpenses += exp.amount * 4;
          } else if (exp.periodicity === "yearly") {
            recurringExpenses += exp.amount;
          }
        }

        // One-off for this year
        const capex = oneOffByProp[prop.id] || [];
        for (const exp of capex) {
          const expDate = dayjs(exp.date);
          if (expDate.year() === year) {
            oneOffExpenses += exp.amount;
          }
        }

        // Debt (annual)
        const loans = loansByProp[prop.id] || [];
        const loan = loans.length > 0 ? loans[0] : null;

        if (loan) {
          // Calculate average monthly rent for the year
          let avgMonthlyRent = 0;
          let avgVacancyPct = 0;

          if (prop.rentalMode === "PER_ROOM" && rooms.length > 0) {
            let totalGross = 0;
            let totalVacancyPct = 0;
            for (let month = 1; month <= 12; month++) {
              const monthDate = dayjs(`${year}-${month.toString().padStart(2, "0")}-01`);
              const agg = getAggregatedRentForMonth({
                property: prop,
                leases,
                rooms,
                monthDate,
              });
              totalGross += agg.monthlyGross;
              totalVacancyPct += agg.effectiveVacancyPct;
            }
            avgMonthlyRent = totalGross / 12;
            avgVacancyPct = totalVacancyPct / 12;
          } else {
            avgMonthlyRent = activeLease.monthlyRent;
            avgVacancyPct = activeLease.vacancyPct || 0;
          }

          const closingCostsTotal = sumClosingCosts(prop.closingCosts);
          const metrics = computeLeveredMetrics({
            monthlyRent: avgMonthlyRent,
            vacancyPct: avgVacancyPct,
            recurring,
            variableAnnualBudget: 0,
            purchasePrice: prop.purchasePrice,
            closingCostsTotal,
            loan,
          });

          debtPayment += metrics.ads;
          debtInterest += metrics.interestsAnnual;
          debtPrincipal += metrics.principalAnnual;
        }
      }

      const noi = rentIncome - recurringExpenses - oneOffExpenses;
      const netCashflow = noi - debtPayment;

      return {
        period,
        rentIncome,
        recurringExpenses,
        oneOffExpenses,
        debtPayment,
        debtInterest,
        debtPrincipal,
        noi,
        netCashflow,
      };
    };

    // Build monthly + yearly arrays once
    const monthly: CashflowRow[] = [];
    for (let i = 0; i < 12; i++) {
      const monthDate = dayjs().year(currentYear).month(i);
      monthly.push(computeMonthCashflow(monthDate));
    }

    const yearly: CashflowRow[] = [];
    for (let i = 0; i < 5; i++) {
      const year = currentYear - 4 + i;
      yearly.push(computeYearCashflow(year));
    }

    setMonthlyData(monthly);
    setYearlyData(yearly);
    
    // Cache the computed data
    cacheRef.current[`${selectedPropertyId}:monthly`] = monthly;
    cacheRef.current[`${selectedPropertyId}:yearly`] = yearly;
    
    setLoading(false);
  }, [
    dataLoaded,
    propsToProcess,
    leasesByProp,
    recurringByProp,
    oneOffByProp,
    loansByProp,
    selectedPropertyId,
    viewMode,
  ]);

  // 4) Derive which data to show from viewMode (no recompute, just select)
  const cashflowData = viewMode === "monthly" ? monthlyData : yearlyData;

  // Totals (sum of rows)
  const totals = useMemo(
    () =>
      cashflowData.reduce(
        (acc, row) => ({
          rentIncome: acc.rentIncome + row.rentIncome,
          recurringExpenses: acc.recurringExpenses + row.recurringExpenses,
          oneOffExpenses: acc.oneOffExpenses + row.oneOffExpenses,
          debtPayment: acc.debtPayment + row.debtPayment,
          debtInterest: acc.debtInterest + row.debtInterest,
          debtPrincipal: acc.debtPrincipal + row.debtPrincipal,
          noi: acc.noi + row.noi,
          netCashflow: acc.netCashflow + row.netCashflow,
        }),
        {
          rentIncome: 0,
          recurringExpenses: 0,
          oneOffExpenses: 0,
          debtPayment: 0,
          debtInterest: 0,
          debtPrincipal: 0,
          noi: 0,
          netCashflow: 0,
        }
      ),
    [cashflowData]
  );

  const chartData = useMemo(
    () =>
      cashflowData.map((row) => ({
        period: row.period,
        ingresos: row.rentIncome,
        gastos: row.recurringExpenses + row.oneOffExpenses,
        deuda: row.debtPayment,
        flujoNeto: row.netCashflow,
      })),
    [cashflowData]
  );

  const displayTotals = useMemo(() => {
    if (chartData.length === 0) {
      return {
        ingresos: 0,
        gastos: 0,
        deuda: 0,
        flujoNeto: 0,
        label: "",
      };
    }

    const last = chartData[chartData.length - 1];

    if (viewMode === "monthly") {
      return {
        ingresos: last.ingresos,
        gastos: last.gastos,
        deuda: last.deuda,
        flujoNeto: last.flujoNeto,
        label: last.period,
      };
    }

    return {
      ingresos: last.ingresos,
      gastos: last.gastos,
      deuda: last.deuda,
      flujoNeto: last.flujoNeto,
      label: `Año ${last.period}`,
    };
  }, [chartData, viewMode]);

  if (!userDoc?.orgId) {
    return <Typography variant="body1">Cargando organización...</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Cashflow
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Vivienda</InputLabel>
              <Select
                value={selectedPropertyId}
                label="Vivienda"
                onChange={(e) => setSelectedPropertyId(e.target.value)}
              >
                <MenuItem value="all">Todas las viviendas</MenuItem>
                {properties.map((prop) => (
                  <MenuItem key={prop.id} value={prop.id}>
                    {prop.address}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={4}>
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(_, newMode) => newMode && setViewMode(newMode)}
              fullWidth
            >
              <ToggleButton value="monthly">Mensual</ToggleButton>
              <ToggleButton value="yearly">Anual</ToggleButton>
            </ToggleButtonGroup>
          </Grid>

          <Grid item xs={12} sm={4}></Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Evolución del Cashflow
        </Typography>

        {/* Summary tiles */}
        {loading ? (
          <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
            {[1, 2, 3, 4].map((i) => (
              <Box key={i} sx={{ flex: "0 1 calc(25% - 12px)", minWidth: 100 }}>
                <Skeleton variant="rectangular" height={60} />
              </Box>
            ))}
          </Box>
        ) : (
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid item xs={6} sm={3}>
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
                  sx={{ fontSize: "0.7rem" }}
                >
                  Ingresos
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  color="#4caf50"
                  sx={{ fontSize: { xs: "0.85rem", sm: "1rem" } }}
                >
                  {formatCurrency(displayTotals.ingresos)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
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
                  sx={{ fontSize: "0.7rem" }}
                >
                  Gastos
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  color="#ff9800"
                  sx={{ fontSize: { xs: "0.85rem", sm: "1rem" } }}
                >
                  {formatCurrency(displayTotals.gastos)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
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
                  sx={{ fontSize: "0.7rem" }}
                >
                  Deuda
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  color="#f44336"
                  sx={{ fontSize: { xs: "0.85rem", sm: "1rem" } }}
                >
                  {formatCurrency(displayTotals.deuda)}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box
                sx={{
                  textAlign: "center",
                  p: 1,
                  bgcolor: "rgba(33, 150, 243, 0.08)",
                  borderRadius: 1,
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  sx={{ fontSize: "0.7rem" }}
                >
                  Flujo Neto
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  color="#2196f3"
                  sx={{ fontSize: { xs: "0.85rem", sm: "1rem" } }}
                >
                  {formatCurrency(displayTotals.flujoNeto)}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        )}

        <Box sx={{ height: { xs: 200, sm: 250 } }}>
          {loading ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
              }}
            >
              <CircularProgress />
            </Box>
          ) : (
            <Line
              data={{
                labels: chartData.map((d) => d.period),
                datasets: [
                  {
                    label: "Ingresos",
                    data: chartData.map((d) => d.ingresos),
                    borderColor: "#4caf50",
                    backgroundColor: "rgba(76, 175, 80, 0.1)",
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
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: "#f44336",
                  },
                  {
                    label: "Flujo Neto",
                    data: chartData.map((d) => d.flujoNeto),
                    borderColor: "#2196f3",
                    backgroundColor: "rgba(33, 150, 243, 0.1)",
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
          )}
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Detalle {viewMode === "monthly" ? "Mensual" : "Anual"}
        </Typography>

        {loading && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, py: 4 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" height={200} />
            ))}
          </Box>
        )}

        {cashflowData.length === 0 && !loading && (
          <Box sx={{ py: 6, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              No hay datos de cashflow aún. Añade contratos y gastos para ver
              movimiento.
            </Typography>
          </Box>
        )}

        <Stack spacing={2}>
          {cashflowData.slice(0, visibleCount).map((row) => (
            <Card key={row.period} variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary">
                  {row.period}
                </Typography>

                <Stack spacing={1.5}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Ingresos
                    </Typography>
                    <Typography variant="body1" fontWeight="medium">
                      <Money amount={row.rentIncome} />
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Gastos Fijos
                    </Typography>
                    <Typography variant="body1">
                      <Money amount={row.recurringExpenses} />
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Gastos Puntuales
                    </Typography>
                    <Typography variant="body1">
                      <Money amount={row.oneOffExpenses} />
                    </Typography>
                  </Box>

                  <Divider />

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="body1" fontWeight="bold">
                      NOI
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      <Money amount={row.noi} />
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Cuota Deuda
                    </Typography>
                    <Typography variant="body1">
                      <Money amount={row.debtPayment} />
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      pl: 2,
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontSize="0.875rem"
                      color="text.secondary"
                    >
                      - Intereses
                    </Typography>
                    <Typography
                      variant="body2"
                      fontSize="0.875rem"
                      color="text.secondary"
                    >
                      <Money amount={row.debtInterest} />
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      pl: 2,
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontSize="0.875rem"
                      color="text.secondary"
                    >
                      - Amortización
                    </Typography>
                    <Typography
                      variant="body2"
                      fontSize="0.875rem"
                      color="text.secondary"
                    >
                      <Money amount={row.debtPrincipal} />
                    </Typography>
                  </Box>

                  <Divider />

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      bgcolor:
                        row.netCashflow >= 0 ? "success.light" : "error.light",
                      p: 1.5,
                      borderRadius: 1,
                      mt: 1,
                    }}
                  >
                    <Typography variant="h6" fontWeight="bold">
                      Flujo Neto
                    </Typography>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      color={
                        row.netCashflow >= 0 ? "success.dark" : "error.dark"
                      }
                    >
                      <Money amount={row.netCashflow} />
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ))}

          {cashflowData.length > visibleCount && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Button
                variant="outlined"
                onClick={() => setVisibleCount((prev) => prev + 6)}
              >
                Cargar más
              </Button>
            </Box>
          )}

          {cashflowData.length > 0 && (
            <Card variant="outlined" sx={{ bgcolor: "grey.100" }}>
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight="bold">
                  TOTAL
                </Typography>

                <Stack spacing={1.5}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="body1" fontWeight="medium">
                      Ingresos
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      <Money amount={totals.rentIncome} />
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="body1" fontWeight="medium">
                      Gastos Fijos
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      <Money amount={totals.recurringExpenses} />
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="body1" fontWeight="medium">
                      Gastos Puntuales
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      <Money amount={totals.oneOffExpenses} />
                    </Typography>
                  </Box>

                  <Divider />

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="body1" fontWeight="bold">
                      NOI
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      <Money amount={totals.noi} />
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="body1" fontWeight="medium">
                      Cuota Deuda
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      <Money amount={totals.debtPayment} />
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="body1" fontWeight="medium">
                      Intereses
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      <Money amount={totals.debtInterest} />
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Typography variant="body1" fontWeight="medium">
                      Amortización
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      <Money amount={totals.debtPrincipal} />
                    </Typography>
                  </Box>

                  <Divider />

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      bgcolor:
                        totals.netCashflow >= 0
                          ? "success.light"
                          : "error.light",
                      p: 1.5,
                      borderRadius: 1,
                      mt: 1,
                    }}
                  >
                    <Typography variant="h6" fontWeight="bold">
                      Flujo Neto Total
                    </Typography>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      color={
                        totals.netCashflow >= 0 ? "success.dark" : "error.dark"
                      }
                    >
                      <Money amount={totals.netCashflow} />
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
