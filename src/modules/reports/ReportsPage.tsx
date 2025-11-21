import { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Divider,
  Alert,
  Link,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import TableChartIcon from "@mui/icons-material/TableChart";
import { useAuth } from "@/auth/authContext";
import { useOrgLimits } from "@/hooks/useOrgLimits";
import {
  getProperties,
  getOneOffExpenses,
  getRecurringExpenses,
} from "@/modules/properties/api";
import {
  Property,
  OneOffExpense,
  RecurringExpense,
} from "@/modules/properties/types";
import { exportToExcel, exportToPDF } from "@/modules/expenses/exportUtils";

export function ReportsPage() {
  const { userDoc } = useAuth();
  const { loading: limitsLoading, plan } = useOrgLimits(userDoc?.orgId);
  const [properties, setProperties] = useState<Property[]>([]);
  const [expenses, setExpenses] = useState<OneOffExpense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<
    RecurringExpense[]
  >([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const isFreePlan = !limitsLoading && plan === "free";

  const loadData = async () => {
    if (!userDoc) return;

    setLoading(true);
    try {
      const props = await getProperties(userDoc.orgId);
      setProperties(props);

      // Load all expenses from all properties
      const allExpenses: OneOffExpense[] = [];
      const allRecurringExpenses: RecurringExpense[] = [];
      for (const prop of props) {
        const propExpenses = await getOneOffExpenses(prop.id);
        allExpenses.push(...propExpenses);

        const propRecurringExpenses = await getRecurringExpenses(prop.id);
        allRecurringExpenses.push(...propRecurringExpenses);
      }
      setExpenses(allExpenses);
      setRecurringExpenses(allRecurringExpenses);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userDoc]);

  // Get available years
  const availableYears = Array.from(
    new Set(expenses.map((exp) => new Date(exp.date).getFullYear().toString()))
  ).sort((a, b) => parseInt(b) - parseInt(a));

  const handleExportExcel = () => {
    if (isFreePlan) return; // hard guard

    // Filter expenses by property and year
    let filteredExpenses = expenses;
    let filteredRecurring = recurringExpenses;

    if (selectedPropertyId !== "all") {
      filteredExpenses = filteredExpenses.filter(
        (exp) => exp.propertyId === selectedPropertyId
      );
      filteredRecurring = filteredRecurring.filter(
        (exp) => exp.propertyId === selectedPropertyId
      );
    }

    if (selectedYear !== "all") {
      filteredExpenses = filteredExpenses.filter((exp) => {
        const expYear = new Date(exp.date).getFullYear().toString();
        return expYear === selectedYear;
      });
    }

    exportToExcel({
      expenses: filteredExpenses,
      recurringExpenses: filteredRecurring,
      properties,
      year: selectedYear,
      propertyId: selectedPropertyId,
    });
  };

  const handleExportPDF = () => {
    if (isFreePlan) return; // hard guard

    // Filter expenses by property and year
    let filteredExpenses = expenses;
    let filteredRecurring = recurringExpenses;

    if (selectedPropertyId !== "all") {
      filteredExpenses = filteredExpenses.filter(
        (exp) => exp.propertyId === selectedPropertyId
      );
      filteredRecurring = filteredRecurring.filter(
        (exp) => exp.propertyId === selectedPropertyId
      );
    }

    if (selectedYear !== "all") {
      filteredExpenses = filteredExpenses.filter((exp) => {
        const expYear = new Date(exp.date).getFullYear().toString();
        return expYear === selectedYear;
      });
    }

    exportToPDF({
      expenses: filteredExpenses,
      recurringExpenses: filteredRecurring,
      properties,
      year: selectedYear,
      propertyId: selectedPropertyId,
    });
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Reportes
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Exportar Gastos para Hacienda
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Genera reportes detallados de gastos deducibles y no deducibles para
          tu declaración de impuestos
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Vivienda</InputLabel>
              <Select
                value={selectedPropertyId}
                label="Vivienda"
                onChange={(e) => setSelectedPropertyId(e.target.value)}
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
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel>Año</InputLabel>
              <Select
                value={selectedYear}
                label="Año"
                onChange={(e) => setSelectedYear(e.target.value)}
                disabled={loading}
              >
                <MenuItem value="all">Todos los años</MenuItem>
                {availableYears.map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <Stack spacing={2}>
              <Button
                variant="contained"
                color="success"
                startIcon={<TableChartIcon />}
                onClick={handleExportExcel}
                size="large"
                disabled={
                  loading ||
                  limitsLoading ||
                  isFreePlan ||
                  expenses.length === 0
                }
                title={
                  isFreePlan
                    ? "Mejora tu plan para habilitar exportación a Excel"
                    : "Exportar a Excel"
                }
                fullWidth
              >
                Exportar a Excel (.xlsx)
              </Button>

              <Button
                variant="contained"
                startIcon={<PictureAsPdfIcon />}
                onClick={handleExportPDF}
                size="large"
                disabled={
                  loading ||
                  limitsLoading ||
                  isFreePlan ||
                  expenses.length === 0
                }
                title={
                  isFreePlan
                    ? "Mejora tu plan para habilitar exportación a PDF"
                    : "Exportar a PDF"
                }
                fullWidth
              >
                Exportar a PDF
              </Button>
            </Stack>

            {isFreePlan && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Estás en el plan <strong>Free</strong>. Las exportaciones están
                deshabilitadas.{" "}
                <Link href="/settings" underline="hover">
                  Mejora tu plan
                </Link>{" "}
                para desbloquear las exportaciones.
              </Alert>
            )}
          </Grid>
        </Grid>

        <Divider sx={{ my: 4 }} />

        <Typography variant="body2" color="text.secondary">
          <strong>Los reportes incluyen:</strong>
        </Typography>
        <Box component="ul" sx={{ mt: 1, color: "text.secondary" }}>
          <li>Resumen de gastos totales y deducibles</li>
          <li>Gastos puntuales (reparaciones, mejoras, etc.)</li>
          <li>Gastos fijos anualizados (comunidad, IBI, seguro)</li>
          <li>Detalle por vivienda con facturas</li>
          <li>Separación entre gastos deducibles y no deducibles</li>
        </Box>
      </Paper>
    </Box>
  );
}
