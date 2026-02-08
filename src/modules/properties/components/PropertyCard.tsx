import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  Chip,
  Box,
  Stack,
  Typography,
  Avatar,
  Grid,
  Alert,
  Button,
  IconButton,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import WarningIcon from "@mui/icons-material/Warning";
import InfoIcon from "@mui/icons-material/Info";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import { PropertyCardData, PropertyAlert } from "../propertyCardUtils";
import { formatCurrency } from "@/utils/format";

interface PropertyCardProps {
  data: PropertyCardData;
}

/**
 * Visual card component for displaying property metrics at a glance
 * Shows cashflow, ROI, occupancy, equity, and alerts
 */
export function PropertyCard({ data }: PropertyCardProps) {
  const navigate = useNavigate();
  const {
    property,
    monthlyRentGross,
    cashflow,
    roi,
    occupancyRate,
    equity,
    equityPercent,
    alerts,
  } = data;

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/properties/${property.id}`);
  };

  const handleExpensesClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/properties/${property.id}?tab=gastos`);
  };

  // Determine border and chip color based on cashflow
  const isPositiveCashflow = cashflow > 0;
  const borderColor = isPositiveCashflow ? "success.main" : "error.main";
  const chipColor = isPositiveCashflow ? "success" : "error";

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <WarningIcon fontSize="small" />;
      case "warning":
        return <InfoIcon fontSize="small" />;
      case "success":
        return <CheckCircleIcon fontSize="small" />;
      default:
        return <InfoIcon fontSize="small" />;
    }
  };

  return (
    <Card
      sx={{
        border: 2,
        borderColor,
        position: "relative",
        transition: "all 0.3s ease",
        cursor: "pointer",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: 6,
        },
      }}
      onClick={handleNavigate}
    >
      {/* Badge de rendimiento en esquina superior derecha */}
      <Chip
        label={`${formatCurrency(monthlyRentGross)}/mes`}
        color={chipColor}
        sx={{
          position: "absolute",
          top: 16,
          right: 16,
          fontWeight: 700,
          zIndex: 1,
        }}
      />

      <CardContent sx={{ flexGrow: 1, pb: 2 }}>
        {/* Header con dirección + icono */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Avatar
            sx={{
              bgcolor: "primary.main",
              width: 56,
              height: 56,
            }}
          >
            <HomeIcon fontSize="large" />
          </Avatar>

          <Box flex={1}>
            <Typography
              variant="h6"
              fontWeight={900}
              noWrap
              sx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {property.address}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Comprada:{" "}
              {new Date(property.purchaseDate || "").toLocaleDateString(
                "es-ES",
                {
                  month: "short",
                  year: "numeric",
                },
              )}
            </Typography>
          </Box>
        </Stack>

        {/* Grid de métricas clave (2x2) */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {/* Métrica 1: Cashflow mensual */}
          <Grid item xs={6}>
            <Box
              sx={{
                p: 1.5,
                bgcolor: cashflow > 0 ? "success.light" : "error.light",
                borderRadius: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Cashflow
              </Typography>
              <Typography
                variant="h6"
                fontWeight={900}
                color={cashflow > 0 ? "success.dark" : "error.dark"}
              >
                {formatCurrency(cashflow)}
              </Typography>
              <Typography variant="caption">/mes</Typography>
            </Box>
          </Grid>

          {/* Métrica 2: ROI */}
          <Grid item xs={6}>
            <Box sx={{ p: 1.5, bgcolor: "grey.100", borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                ROI
              </Typography>
              <Typography variant="h6" fontWeight={900}>
                {roi.toFixed(1)}%
              </Typography>
              <Typography variant="caption">anual</Typography>
            </Box>
          </Grid>

          {/* Métrica 3: Ocupación */}
          <Grid item xs={6}>
            <Box sx={{ p: 1.5, bgcolor: "grey.100", borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Ocupación
              </Typography>
              <Typography variant="h6" fontWeight={900}>
                {occupancyRate.toFixed(0)}%
              </Typography>
              {occupancyRate < 100 && (
                <Typography variant="caption" color="warning.main">
                  ⚠️ Vacío
                </Typography>
              )}
            </Box>
          </Grid>

          {/* Métrica 4: Equity */}
          <Grid item xs={6}>
            <Box sx={{ p: 1.5, bgcolor: "grey.100", borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Equity
              </Typography>
              <Typography variant="h6" fontWeight={900}>
                {formatCurrency(equity)}
              </Typography>
              <Typography variant="caption">
                {equityPercent.toFixed(0)}%
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Alertas importantes */}
        {alerts.length > 0 && (
          <Box sx={{ mt: 2 }}>
            {alerts.map((alert: PropertyAlert, idx: number) => (
              <Alert
                key={idx}
                severity={alert.severity as any}
                sx={{ mb: 1 }}
                icon={getAlertIcon(alert.severity)}
              >
                <Typography variant="body2">{alert.message}</Typography>
              </Alert>
            ))}
          </Box>
        )}

        {/* Action buttons */}
        {alerts.length === 0 && (
          <Alert severity="success" sx={{ mt: 2 }} icon={<CheckCircleIcon />}>
            <Typography variant="body2">✅ Todo está en orden</Typography>
          </Alert>
        )}
      </CardContent>

      {/* Bottom action buttons */}
      <Box sx={{ px: 2, pb: 2, pt: 0 }}>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            fullWidth
            size="small"
            onClick={handleNavigate}
          >
            Ver detalles
          </Button>
          <IconButton
            color="primary"
            size="small"
            onClick={handleExpensesClick}
            sx={{ flexShrink: 0 }}
          >
            <TrendingUpIcon />
          </IconButton>
        </Stack>
      </Box>
    </Card>
  );
}
