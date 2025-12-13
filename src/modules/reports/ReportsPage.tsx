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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import TableChartIcon from "@mui/icons-material/TableChart";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import dayjs from "dayjs";
import { useAuth } from "@/auth/authContext";
import { useOrgLimits } from "@/hooks/useOrgLimits";
import {
  getProperties,
  getOneOffExpenses,
  getRecurringExpenses,
  getLeases,
  getRooms,
} from "@/modules/properties/api";
import {
  Property,
  OneOffExpense,
  RecurringExpense,
  Lease,
} from "@/modules/properties/types";
import { exportToExcel, exportToPDF } from "@/modules/expenses/exportUtils";
import { exportTaxReportToExcel, exportTaxReportToPDF } from "./taxExportUtils";
import { getAggregatedRentForMonth } from "@/modules/properties/rentalAggregation";
import { formatCurrency } from "@/utils/format";

export function ReportsPage() {
  const { userDoc } = useAuth();
  const { loading: limitsLoading, plan } = useOrgLimits(userDoc?.orgId);
  const [properties, setProperties] = useState<Property[]>([]);
  const [expenses, setExpenses] = useState<OneOffExpense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<
    RecurringExpense[]
  >([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // Tax report state
  const [taxReportData, setTaxReportData] = useState<any>(null);
  const [showTaxReport, setShowTaxReport] = useState(false);

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
      const allLeases: Lease[] = [];
      for (const prop of props) {
        const propExpenses = await getOneOffExpenses(prop.id);
        allExpenses.push(...propExpenses);

        const propRecurringExpenses = await getRecurringExpenses(prop.id);
        allRecurringExpenses.push(...propRecurringExpenses);

        const propLeases = await getLeases(prop.id);
        allLeases.push(...propLeases);
      }
      setExpenses(allExpenses);
      setRecurringExpenses(allRecurringExpenses);
      setLeases(allLeases);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userDoc]);

  // Calculate tax report data for a specific year
  const calculateTaxReport = async (year: string, propertyId?: string) => {
    const reportYear = parseInt(year);
    let totalRentalIncome = 0;
    let totalDeductions = 0;
    const propertyReports: any[] = [];

    // Filter properties if specific property selected
    const targetProperties =
      propertyId && propertyId !== "all"
        ? properties.filter((p) => p.id === propertyId)
        : properties;

    for (const property of targetProperties) {
      // Load property data once
      const [leases, rooms] = await Promise.all([
        getLeases(property.id),
        property.rentalMode === "PER_ROOM"
          ? getRooms(property.id)
          : Promise.resolve([]),
      ]);

      let propertyIncome = 0;

      // Calculate income for each month of the fiscal year
      for (let month = 0; month < 12; month++) {
        const monthDate = dayjs().year(reportYear).month(month);

        if (property.rentalMode === "PER_ROOM") {
          // PER_ROOM: Use aggregation helper
          const agg = getAggregatedRentForMonth({
            property,
            leases,
            rooms,
            monthDate,
          });
          propertyIncome += agg.monthlyNet;
        } else {
          // ENTIRE_UNIT: Find active unit lease
          const activeLease = leases.find(
            (lease: Lease) =>
              !lease.roomId &&
              lease.isActive !== false &&
              dayjs(lease.startDate).isBefore(monthDate.endOf("month")) &&
              (!lease.endDate ||
                dayjs(lease.endDate).isAfter(monthDate.startOf("month")))
          );

          if (activeLease) {
            const monthlyNet =
              activeLease.monthlyRent * (1 - (activeLease.vacancyPct || 0));
            propertyIncome += monthlyNet;
          }
        }
      }

      totalRentalIncome += propertyIncome;

      // Calculate deductions for this property
      const propertyExpenses = expenses.filter(
        (exp) => exp.propertyId === property.id
      );
      const propertyRecurring = recurringExpenses.filter(
        (exp) => exp.propertyId === property.id
      );

      const deductibleExpenses = propertyExpenses.filter(
        (exp) => exp.isDeductible !== false
      );
      const deductibleRecurring = propertyRecurring.filter(
        (exp) => exp.isDeductible !== false
      );

      const oneOffDeductions = deductibleExpenses.reduce(
        (sum, exp) => sum + exp.amount,
        0
      );
      const recurringDeductions = deductibleRecurring.reduce((sum, exp) => {
        // Annualize recurring expenses
        switch (exp.periodicity) {
          case "monthly":
            return sum + exp.amount * 12;
          case "quarterly":
            return sum + exp.amount * 4;
          case "yearly":
            return sum + exp.amount;
          default:
            return sum + exp.amount;
        }
      }, 0);

      const propertyDeductions = oneOffDeductions + recurringDeductions;
      totalDeductions += propertyDeductions;

      propertyReports.push({
        property: property.address,
        rentalIncome: propertyIncome,
        deductions: propertyDeductions,
        netIncome: propertyIncome - propertyDeductions,
      });
    }

    return {
      year: reportYear,
      totalRentalIncome,
      totalDeductions,
      netTaxableIncome: totalRentalIncome - totalDeductions,
      propertyReports,
    };
  };

  const handleGenerateTaxReport = async () => {
    if (selectedYear === "all") {
      alert(
        "Por favor selecciona un año específico para el reporte de Hacienda"
      );
      return;
    }

    setLoading(true);
    try {
      const report = await calculateTaxReport(selectedYear, selectedPropertyId);
      setTaxReportData(report);
      setShowTaxReport(true);
    } catch (error) {
      console.error("Error generating tax report:", error);
      alert("Error al generar el reporte de Hacienda");
    } finally {
      setLoading(false);
    }
  };

  const handleExportTaxReportExcel = () => {
    if (!taxReportData) return;
    exportTaxReportToExcel(taxReportData);
  };

  const handleExportTaxReportPDF = () => {
    if (!taxReportData) return;
    exportTaxReportToPDF(taxReportData);
  };

  // Get available years from both expenses and leases
  const availableYears: string[] = Array.from(
    new Set([
      ...expenses.map((exp) => new Date(exp.date).getFullYear().toString()),
      ...leases.flatMap((lease) =>
        [
          new Date(lease.startDate).getFullYear().toString(),
          lease.endDate
            ? new Date(lease.endDate).getFullYear().toString()
            : null,
        ].filter((year): year is string => year !== null)
      ),
    ])
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

      {/* Tax Report Section */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Reporte de Hacienda - Ingresos por Alquiler
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Genera reportes de ingresos por alquiler para tu declaración de
          impuestos. Incluye cálculo correcto de rentas para propiedades
          PER_ROOM.
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
              <InputLabel>Año Fiscal</InputLabel>
              <Select
                value={selectedYear}
                label="Año Fiscal"
                onChange={(e) => setSelectedYear(e.target.value)}
                disabled={loading}
              >
                <MenuItem value="all">Selecciona un año</MenuItem>
                {availableYears.map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AccountBalanceIcon />}
              onClick={handleGenerateTaxReport}
              size="large"
              disabled={loading || selectedYear === "all"}
              fullWidth
            >
              Generar Reporte de Hacienda
            </Button>
          </Grid>
        </Grid>

        {showTaxReport && taxReportData && (
          <Box sx={{ mt: 4 }}>
            <Divider sx={{ mb: 3 }} />
            <Typography variant="h6" gutterBottom>
              Reporte de Hacienda - Año {taxReportData.year}
            </Typography>

            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Paper sx={{ p: 2, textAlign: "center" }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Rendimiento Íntegro
                  </Typography>
                  <Typography variant="h5" color="success.main">
                    {formatCurrency(taxReportData.totalRentalIncome)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper sx={{ p: 2, textAlign: "center" }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Gastos Deducibles
                  </Typography>
                  <Typography variant="h5" color="error.main">
                    {formatCurrency(taxReportData.totalDeductions)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper sx={{ p: 2, textAlign: "center" }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Base Imponible
                  </Typography>
                  <Typography variant="h5" color="primary.main">
                    {formatCurrency(taxReportData.netTaxableIncome)}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
              Detalle por Vivienda
            </Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                    <TableCell>Vivienda</TableCell>
                    <TableCell align="right">Ingresos por Alquiler</TableCell>
                    <TableCell align="right">Gastos Deducibles</TableCell>
                    <TableCell align="right">Rendimiento Neto</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {taxReportData.propertyReports.map(
                    (report: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{report.property}</TableCell>
                        <TableCell align="right">
                          {formatCurrency(report.rentalIncome)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(report.deductions)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(report.netIncome)}
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Alert severity="info" sx={{ mt: 3 }}>
              <Typography variant="body2">
                <strong>Nota:</strong> Este reporte calcula los ingresos por
                alquiler considerando todas las habitaciones ocupadas para
                propiedades PER_ROOM. Los cálculos respetan períodos de alquiler
                parciales y tasas de vacancia.
              </Typography>
            </Alert>

            <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<FileDownloadIcon />}
                onClick={handleExportTaxReportExcel}
                disabled={!taxReportData}
              >
                Exportar a Excel
              </Button>
              <Button
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                onClick={handleExportTaxReportPDF}
                disabled={!taxReportData}
              >
                Exportar a PDF
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
