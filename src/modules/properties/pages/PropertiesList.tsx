import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import {
  Box,
  Button,
  Typography,
  IconButton,
  Snackbar,
  Alert,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  Stack,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import HomeIcon from "@mui/icons-material/Home";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

import { useAuth } from "@/auth/authContext";
import { useOrgBilling } from "@/hooks/useOrgBilling";
import {
  getDashboard,
  deleteProperty,
} from "../api";
import { Property } from "../types";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  computeLeveredMetrics,
  sumClosingCosts,
  buildAmortizationSchedule,
} from "../calculations";
import { getAggregatedRentForMonth } from "../rentalAggregation";
import { formatPercent, formatCurrency } from "@/utils/format";

/**
 * Calculate current loan balance based on months elapsed since start date
 */
function getRemainingLoanBalance(
  loan: any,
  currentDate: Date = new Date()
): number {
  if (!loan || !loan.startDate || !loan.principal || !loan.termMonths) {
    return 0;
  }

  try {
    const startDate = new Date(loan.startDate);
    const monthsElapsed = Math.floor(
      (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
        (currentDate.getMonth() - startDate.getMonth())
    );

    if (monthsElapsed < 0) return loan.principal;
    if (monthsElapsed >= loan.termMonths) return 0;

    const schedule = buildAmortizationSchedule({
      principal: loan.principal,
      annualRatePct: loan.annualRatePct || 0,
      termMonths: loan.termMonths,
      interestOnlyMonths: loan.interestOnlyMonths || 0,
    });

    if (monthsElapsed > 0 && monthsElapsed <= schedule.schedule.length) {
      return schedule.schedule[monthsElapsed - 1]?.balance || 0;
    }

    return loan.principal;
  } catch (error) {
    console.error("Error calculating remaining loan balance:", error);
    return loan?.principal || 0;
  }
}

export function PropertiesList() {
  const navigate = useNavigate();
  const { userDoc } = useAuth();
  const { loading: limitsLoading, propertyLimit } = useOrgBilling();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true); // loading properties list
  const [rowsLoading, setRowsLoading] = useState(false); // loading metrics/rows

  // Store all data from dashboard
  const [dashboardData, setDashboardData] = useState<any>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });

  const hasReachedLimit = useMemo(
    () => !limitsLoading && properties.length >= propertyLimit,
    [limitsLoading, properties.length, propertyLimit]
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

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;

    try {
      await deleteProperty(deleteId);
      setSnackbar({
        open: true,
        message: "Vivienda eliminada",
        severity: "success",
      });
      loadData();
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Error al eliminar",
        severity: "error",
      });
    } finally {
      setDeleteId(null);
    }
  }, [deleteId, loadData]);

  // Build enriched rows with metrics
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    const enrichRows = async () => {
      if (properties.length === 0 || !dashboardData) {
        setRows([]);
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
          if (!leasesByProp[lease.propertyId]) leasesByProp[lease.propertyId] = [];
          leasesByProp[lease.propertyId].push(lease);
        });

        dashboardData.loans.forEach((loan: any) => {
          if (!loansByProp[loan.propertyId]) loansByProp[loan.propertyId] = [];
          loansByProp[loan.propertyId].push(loan);
        });

        dashboardData.recurringExpenses.forEach((expense: any) => {
          if (!recurringByProp[expense.propertyId]) recurringByProp[expense.propertyId] = [];
          recurringByProp[expense.propertyId].push(expense);
        });

        dashboardData.rooms.forEach((room: any) => {
          if (!roomsByProp[room.propertyId]) roomsByProp[room.propertyId] = [];
          roomsByProp[room.propertyId].push(room);
        });

        const enriched = properties.map((property) => {
          // Get data for this property from grouped dashboard data
          const leases = leasesByProp[property.id] || [];
          const loan = (loansByProp[property.id] || [])[0]; // Get first loan
          const recurring = recurringByProp[property.id] || [];
          const rooms = roomsByProp[property.id] || [];

            const closingCostsTotal = sumClosingCosts(property.closingCosts);
            const totalInvestment = property.purchasePrice + closingCostsTotal;

            const remainingBalance = getRemainingLoanBalance(loan);

            const agg = getAggregatedRentForMonth({
              property,
              leases,
              rooms,
              monthDate,
            });

            let monthlyRentNet: number;
            let monthlyRentGross: number;
            let occupancy: number;

            if (property.rentalMode === "PER_ROOM") {
              monthlyRentNet = agg.monthlyNet;
              monthlyRentGross = agg.monthlyGross;
              occupancy =
                agg.totalRooms > 0
                  ? (agg.occupiedRooms / agg.totalRooms) * 100
                  : 0;
            } else {
              const activeUnitLease = leases.find(
                (lease) => !lease.roomId && lease.isActive !== false
              );

              if (!activeUnitLease) {
                monthlyRentNet = 0;
                monthlyRentGross = 0;
                occupancy = 0;
              } else {
                monthlyRentNet =
                  activeUnitLease.monthlyRent *
                  (1 - (activeUnitLease.vacancyPct || 0));
                monthlyRentGross = activeUnitLease.monthlyRent;
                occupancy = (1 - (activeUnitLease.vacancyPct || 0)) * 100;
              }
            }

            const metrics = computeLeveredMetrics({
              monthlyRent: monthlyRentGross,
              vacancyPct: agg.effectiveVacancyPct,
              recurring,
              variableAnnualBudget: 0,
              purchasePrice: property.purchasePrice,
              closingCostsTotal,
              loan,
            });

          return {
            id: property.id,
            address: property.address,
            purchasePrice: property.purchasePrice,
            currentValue: property.currentValue || property.purchasePrice,
            totalInvestment,
            monthlyRent: monthlyRentNet,
            capRate: metrics.capRateNet,
            cashOnCash: metrics.cashOnCash,
            occupancy,
            loanBalance: remainingBalance,
            loan,
            computed: {
              monthlyRentNet,
              monthlyRentGross,
              effectiveVacancyPct: agg.effectiveVacancyPct,
              occupiedRooms: agg.occupiedRooms,
              totalRooms: agg.totalRooms,
              rentalMode: property.rentalMode,
            },
          };
        });

        if (!cancelled) setRows(enriched);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setSnackbar({
            open: true,
            message: "Error al calcular métricas",
            severity: "error",
          });
          setRows([]);
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

  return (
    <Box>
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

      <Grid container spacing={3}>
        {rows.map((row) => (
          <Grid item xs={12} sm={6} lg={4} key={row.id}>
            <Card
              sx={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                transition: "all 0.3s ease",
                "&:hover": { transform: "translateY(-4px)", boxShadow: 4 },
                cursor: "pointer",
              }}
              onClick={() => navigate(`/properties/${row.id}`)}
            >
              <CardContent sx={{ flexGrow: 1, pb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", mb: 3 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 2,
                      bgcolor: "primary.main",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mr: 2,
                      flexShrink: 0,
                    }}
                  >
                    <HomeIcon sx={{ fontSize: 32, color: "white" }} />
                  </Box>

                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography
                      variant="h6"
                      component="div"
                      sx={{
                        lineHeight: 1.3,
                        mb: 0.5,
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {row.address.split(",")[0]}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <LocationOnIcon
                        sx={{ fontSize: 18, color: "text.secondary", mr: 0.5 }}
                      />
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.address.split(",").slice(1).join(",")}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Stack spacing={2}>
                  <Box sx={{ display: "flex", gap: 3 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        Precio Vivienda
                      </Typography>
                      <Typography
                        variant="body1"
                        fontWeight={600}
                        color="primary.main"
                      >
                        {formatCurrency(row.purchasePrice)}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        Valor Actual
                      </Typography>
                      <Typography
                        variant="body1"
                        fontWeight={600}
                        color="secondary.main"
                      >
                        {formatCurrency(row.currentValue)}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: "flex", gap: 3 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        Hipoteca Pendiente
                      </Typography>
                      <Typography
                        variant="body1"
                        fontWeight={600}
                        color={
                          row.loanBalance > 0 ? "error.main" : "success.main"
                        }
                      >
                        {row.loanBalance > 0
                          ? formatCurrency(row.loanBalance)
                          : "Pagada"}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                      >
                        Renta Mensual
                      </Typography>
                      <Typography
                        variant="body1"
                        fontWeight={600}
                        color="success.main"
                      >
                        {formatCurrency(row.monthlyRent)}
                      </Typography>
                    </Box>
                  </Box>

                  <Box
                    sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}
                  >
                    <Tooltip title="Cap Rate Neto">
                      <Chip
                        icon={<TrendingUpIcon />}
                        label={formatPercent(row.capRate, 2)}
                        color={
                          row.capRate > 5
                            ? "success"
                            : row.capRate > 3
                              ? "warning"
                              : "default"
                        }
                        size="small"
                      />
                    </Tooltip>
                    <Tooltip title="Cash-on-Cash">
                      <Chip
                        label={`CoC: ${formatPercent(row.cashOnCash, 2)}`}
                        color={
                          row.cashOnCash > 5
                            ? "success"
                            : row.cashOnCash > 3
                              ? "warning"
                              : "default"
                        }
                        size="small"
                      />
                    </Tooltip>
                    <Tooltip title="Ocupación">
                      <Chip
                        label={`${formatPercent(row.occupancy, 0)}`}
                        color={
                          row.occupancy === 100
                            ? "success"
                            : row.occupancy > 0
                              ? "warning"
                              : "error"
                        }
                        size="small"
                      />
                    </Tooltip>
                  </Box>
                </Stack>
              </CardContent>

              <CardActions sx={{ justifyContent: "flex-end", pt: 0 }}>
                <Tooltip title="Editar">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/properties/${row.id}`);
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Eliminar">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(row.id);
                    }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <ConfirmDialog
        open={deleteId !== null}
        title="Eliminar vivienda"
        message="¿Estás seguro de que deseas eliminar esta vivienda? Se eliminarán también todos los datos relacionados."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

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
