import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  Box,
  Button,
  Typography,
  Snackbar,
  Alert,
  Card,
  Grid,
  Stack,
  Tooltip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Link,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import HomeIcon from "@mui/icons-material/Home";

import { useAuth } from "@/auth/authContext";
import { useOrgBilling } from "@/hooks/useOrgBilling";
import { getDashboard } from "../api";
import { Property } from "../types";
import { getMonthlyRentForDate } from "../calculations";
import { getAggregatedRentForMonth } from "../rentalAggregation";
import { PropertyCard } from "../components/PropertyCard";
import { PortfolioSummary } from "../components/PortfolioSummary";
import {
  calculatePropertyCardData,
  sortProperties,
  filterProperties,
  PropertyCardData,
} from "../propertyCardUtils";

export function PropertiesList() {
  const navigate = useNavigate();
  const { userDoc } = useAuth();
  const { loading: limitsLoading, propertyLimit } = useOrgBilling();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true); // loading properties list
  const [rowsLoading, setRowsLoading] = useState(false); // loading metrics/rows

  // Store all data from dashboard
  const [dashboardData, setDashboardData] = useState<any>(null);

  // Filter and sort state
  const [sortBy, setSortBy] = useState<string>("cashflow-desc");
  const [filter, setFilter] = useState<string>("all");

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });

  const hasReachedLimit = useMemo(
    () => !limitsLoading && properties.length >= propertyLimit,
    [limitsLoading, properties.length, propertyLimit],
  );

  const loadData = useCallback(async () => {
    if (!userDoc?.orgId) return;

    setLoading(true);
    try {
      // Single optimized API call instead of N+1 queries
      const data = await getDashboard();
      setProperties(data.properties);
      setDashboardData(data);
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Error al cargar viviendas",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [userDoc?.orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build enriched rows with metrics
  const [cardData, setCardData] = useState<PropertyCardData[]>([]);

  useEffect(() => {
    let cancelled = false;

    const enrichRows = async () => {
      if (properties.length === 0 || !dashboardData) {
        setCardData([]);
        return;
      }

      setRowsLoading(true);

      // compute once (avoid calling dayjs() per property)
      const monthDate = dayjs();

      try {
        // Group dashboard data by propertyId for quick lookup
        const leasesByProp: Record<string, any[]> = {};
        const loansByProp: Record<string, any[]> = {};
        const recurringByProp: Record<string, any[]> = {};
        const roomsByProp: Record<string, any[]> = {};

        dashboardData.leases.forEach((lease: any) => {
          if (!leasesByProp[lease.propertyId])
            leasesByProp[lease.propertyId] = [];
          leasesByProp[lease.propertyId].push(lease);
        });

        dashboardData.loans.forEach((loan: any) => {
          if (!loansByProp[loan.propertyId]) loansByProp[loan.propertyId] = [];
          loansByProp[loan.propertyId].push(loan);
        });

        dashboardData.recurringExpenses.forEach((expense: any) => {
          if (!recurringByProp[expense.propertyId])
            recurringByProp[expense.propertyId] = [];
          recurringByProp[expense.propertyId].push(expense);
        });

        dashboardData.rooms.forEach((room: any) => {
          if (!roomsByProp[room.propertyId]) roomsByProp[room.propertyId] = [];
          roomsByProp[room.propertyId].push(room);
        });

        // Helper function to check if lease is active in a given month
        const isLeaseActiveInMonth = (lease: any, monthDate: any): boolean => {
          if (!lease.startDate) return false;
          const start = dayjs(lease.startDate);
          const end = lease.endDate ? dayjs(lease.endDate) : null;

          const startsOnOrBefore =
            monthDate.isSame(start, "month") || monthDate.isAfter(start, "month");
          const endsOnOrAfter =
            !end ||
            monthDate.isSame(end, "month") ||
            monthDate.isBefore(end, "month");

          return startsOnOrBefore && endsOnOrAfter;
        };

        const enriched = properties.map((property) => {
          // Get data for this property from grouped dashboard data
          const leases = leasesByProp[property.id] || [];
          const loan = (loansByProp[property.id] || [])[0]; // Get first loan
          const recurring = recurringByProp[property.id] || [];
          const rooms = roomsByProp[property.id] || [];

          const agg = getAggregatedRentForMonth({
            property,
            leases,
            rooms,
            monthDate,
          });

          // ✅ CAMBIO: Usar RENTA NETA (dinero real que entra después de vacancia)
          let monthlyRent: number;
          let monthlyRentGross: number;
          let occupancy: number;

          if (property.rentalMode === "PER_ROOM") {
            monthlyRentGross = agg.monthlyGross;
            monthlyRent = agg.monthlyNet; // ✅ NET
            occupancy =
              agg.totalRooms > 0
                ? (agg.occupiedRooms / agg.totalRooms) * 100
                : 0;
          } else {
            const activeUnitLease = leases.find(
              (lease) => !lease.roomId && isLeaseActiveInMonth(lease, monthDate),
            );

            if (!activeUnitLease) {
              monthlyRent = 0;
              monthlyRentGross = 0;
              occupancy = 0;
            } else {
              const currentRent = getMonthlyRentForDate(
                activeUnitLease,
                monthDate,
              );
              monthlyRentGross = currentRent;
              const vacancyPct = activeUnitLease.vacancyPct || 0;
              monthlyRent = currentRent * (1 - vacancyPct); // ✅ NET
              occupancy = (1 - vacancyPct) * 100;
            }
          }

          // Use calculation function (now uses computeLeveredMetrics internally)
          return calculatePropertyCardData(
            property,
            monthlyRent, // ✅ NET rent (after vacancy)
            monthlyRentGross, // ✅ GROSS rent (before vacancy)
            recurring, // ✅ Pass full array, computeLeveredMetrics will annualize
            loan,
            occupancy,
          );
        });

        if (!cancelled) setCardData(enriched);
      } catch (error) {
        console.error("Error calculating metrics:", error);
        if (!cancelled) {
          setSnackbar({
            open: true,
            message: `Error al calcular métricas: ${error instanceof Error ? error.message : "Error desconocido"}`,
            severity: "error",
          });
          setCardData([]);
        }
      } finally {
        if (!cancelled) setRowsLoading(false);
      }
    };

    enrichRows();

    return () => {
      cancelled = true;
    };
  }, [properties, dashboardData]);

  const showInitialLoading = loading && properties.length === 0;
  const showRowsLoading = rowsLoading && properties.length > 0;

  // Calculate portfolio summary
  const portfolioSummary = useMemo(() => {
    const totalCashflow = cardData.reduce(
      (sum, card) => sum + card.cashflow,
      0,
    );
    const avgROI =
      cardData.length > 0
        ? cardData.reduce((sum, card) => sum + card.roi, 0) / cardData.length
        : 0;
    const totalEquity = cardData.reduce((sum, card) => sum + card.equity, 0);

    return {
      totalCashflow,
      avgROI,
      totalEquity,
    };
  }, [cardData]);

  // Apply filters and sorting
  const filteredAndSortedCards = useMemo(() => {
    const filtered = filterProperties(cardData, filter);
    const sorted = sortProperties(filtered, sortBy);
    return sorted;
  }, [cardData, filter, sortBy]);

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          mb: 3,
          alignItems: "center",
        }}
      >
        <Typography variant="h4">Viviendas</Typography>
        <Tooltip
          title={
            hasReachedLimit
              ? "Plan Free: Límite de 1 vivienda alcanzado. Mejora tu plan para agregar más."
              : ""
          }
          arrow
        >
          <span>
            <Button
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              onClick={() => navigate("/properties/new")}
              disabled={limitsLoading || hasReachedLimit}
            >
              Nueva Vivienda
            </Button>
          </span>
        </Tooltip>
      </Box>

      {showInitialLoading && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <CircularProgress size={18} />
          <Typography>Cargando viviendas...</Typography>
        </Box>
      )}

      {showRowsLoading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Calculando métricas (rentas, ocupación, hipoteca)...
        </Alert>
      )}

      {!loading && !rowsLoading && properties.length === 0 && (
        <Card sx={{ p: 6, textAlign: "center", bgcolor: "background.default" }}>
          <Box
            sx={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              bgcolor: "primary.light",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 3",
            }}
          >
            <HomeIcon sx={{ fontSize: 60, color: "primary.main" }} />
          </Box>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
            No tienes viviendas todavía
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            paragraph
            sx={{ maxWidth: 500, margin: "0 auto 3" }}
          >
            Añade tu primera vivienda para empezar a gestionar tus ingresos,
            gastos y contratos de alquiler.
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={() => navigate("/properties/new")}
            sx={{ minWidth: 200, py: 1.5 }}
          >
            Añadir Vivienda
          </Button>
        </Card>
      )}

      {/* Portfolio Summary Card */}
      {!loading && cardData.length > 0 && (
        <PortfolioSummary
          totalCashflow={portfolioSummary.totalCashflow}
          avgROI={portfolioSummary.avgROI}
          totalEquity={portfolioSummary.totalEquity}
          propertyCount={properties.length}
        />
      )}

      {/* Plan limit warning */}
      {!loading && hasReachedLimit && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Has alcanzado el límite de {propertyLimit} propiedades para tu plan.{" "}
          <Link href="/billing" sx={{ fontWeight: 700, cursor: "pointer" }}>
            Actualiza tu plan
          </Link>
        </Alert>
      )}

      {/* Filters and sorting */}
      {!loading && cardData.length > 0 && (
        <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Ordenar por</InputLabel>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              label="Ordenar por"
            >
              <MenuItem value="cashflow-desc">
                Cashflow (mayor a menor)
              </MenuItem>
              <MenuItem value="cashflow-asc">Cashflow (menor a mayor)</MenuItem>
              <MenuItem value="roi-desc">ROI (mayor a menor)</MenuItem>
              <MenuItem value="date-desc">Más reciente</MenuItem>
              <MenuItem value="address">Dirección (A-Z)</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Filtrar</InputLabel>
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              label="Filtrar"
            >
              <MenuItem value="all">Todas</MenuItem>
              <MenuItem value="positive">Solo rentables</MenuItem>
              <MenuItem value="negative">Solo con pérdidas</MenuItem>
              <MenuItem value="vacant">Vacías</MenuItem>
              <MenuItem value="expiring">Contratos por vencer</MenuItem>
            </Select>
          </FormControl>

          <Box flex={1} />
        </Stack>
      )}

      {/* Cards Grid */}
      <Grid container spacing={3}>
        {filteredAndSortedCards.map((card) => (
          <Grid item xs={12} sm={6} lg={4} key={card.property.id}>
            <PropertyCard data={card} />
          </Grid>
        ))}
      </Grid>

      {/* Empty state after filtering */}
      {!loading &&
        filteredAndSortedCards.length === 0 &&
        cardData.length > 0 && (
          <Card
            sx={{ p: 6, textAlign: "center", bgcolor: "background.default" }}
          >
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              No hay viviendas que coincidan con los filtros
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Intenta cambiar los filtros o el criterio de ordenación
            </Typography>
          </Card>
        )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
