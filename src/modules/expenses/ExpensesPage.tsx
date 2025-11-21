import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Stack,
  Divider,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { useAuth } from "@/auth/authContext";
import {
  getProperties,
  getOneOffExpenses,
  deleteOneOffExpense,
} from "@/modules/properties/api";
import { Property, OneOffExpense } from "@/modules/properties/types";
import { Money } from "@/components/Money";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ExpenseFormDialog } from "./ExpenseFormDialog";
import { formatDate } from "@/utils/date";

const categoryLabels: Record<string, string> = {
  renovation: "Reforma",
  repair: "Reparación",
  maintenance: "Mantenimiento",
  furniture: "Mobiliario",
  appliance: "Electrodoméstico",
  improvement: "Mejora",
  legal: "Gastos Legales",
  agency: "Agencia",
  other: "Otro",
};

export function ExpensesPage() {
  const { userDoc } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [expenses, setExpenses] = useState<OneOffExpense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<OneOffExpense[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<OneOffExpense | null>(
    null
  );

  const loadData = async () => {
    if (!userDoc?.orgId) return;

    setLoading(true);
    try {
      const props = await getProperties(userDoc.orgId);
      setProperties(props);

      // Load all expenses from all properties
      const allExpenses: OneOffExpense[] = [];
      for (const prop of props) {
        const propExpenses = await getOneOffExpenses(prop.id);
        allExpenses.push(...propExpenses);
      }
      setExpenses(allExpenses);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userDoc]);

  // Filter expenses based on property and year
  useEffect(() => {
    let filtered = expenses;

    if (selectedPropertyId !== "all") {
      filtered = filtered.filter(
        (exp) => exp.propertyId === selectedPropertyId
      );
    }

    if (selectedYear !== "all") {
      filtered = filtered.filter((exp) => {
        const expYear = new Date(exp.date).getFullYear().toString();
        return expYear === selectedYear;
      });
    }

    setFilteredExpenses(filtered);
  }, [expenses, selectedPropertyId, selectedYear]);

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await deleteOneOffExpense(deleteId);
      loadData();
    } catch (error) {
      console.error("Error deleting expense:", error);
    } finally {
      setDeleteId(null);
    }
  };

  const handleAdd = () => {
    setEditingExpense(null);
    setDialogOpen(true);
  };

  const handleEdit = (expense: OneOffExpense) => {
    setEditingExpense(expense);
    setDialogOpen(true);
  };

  const handleSave = () => {
    setDialogOpen(false);
    loadData();
  };

  // Get property address helper
  const getPropertyAddress = (propertyId: string) => {
    const prop = properties.find((p) => p.id === propertyId);
    return prop?.address || "N/A";
  };

  // Calculate totals
  const totalExpenses = filteredExpenses.reduce(
    (sum, exp) => sum + exp.amount,
    0
  );
  const deductibleTotal = filteredExpenses
    .filter((exp) => exp.isDeductible !== false)
    .reduce((sum, exp) => sum + exp.amount, 0);

  // Get available years - always show current year + last 3 years
  const currentYear = new Date().getFullYear();
  const defaultYears = [
    currentYear.toString(),
    (currentYear - 1).toString(),
    (currentYear - 2).toString(),
    (currentYear - 3).toString(),
  ];

  const expenseYears = Array.from(
    new Set(expenses.map((exp) => new Date(exp.date).getFullYear().toString()))
  );

  const availableYears = Array.from(
    new Set([...defaultYears, ...expenseYears])
  ).sort((a, b) => parseInt(b) - parseInt(a));

  // Sort expenses by date descending
  const sortedExpenses = [...filteredExpenses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h4">Gastos y Reparaciones</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Nuevo Gasto
        </Button>
      </Box>

      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Grid container spacing={2} alignItems="stretch">
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel>Vivienda</InputLabel>
              <Select
                value={selectedPropertyId}
                label="Vivienda"
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                sx={{ minHeight: 48 }}
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

          <Grid item xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel>Año</InputLabel>
              <Select
                value={selectedYear}
                label="Año"
                onChange={(e) => setSelectedYear(e.target.value)}
                sx={{ minHeight: 48 }}
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

          <Grid item xs={12} sm={5}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    bgcolor: "rgba(244, 67, 54, 0.08)",
                    borderRadius: 1,
                    height: "100%",
                  }}
                >
                  <Typography
                    variant="caption"
                    display="block"
                    color="text.secondary"
                    sx={{ fontSize: { xs: "0.7rem", sm: "0.75rem" } }}
                  >
                    Total Gastos
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{
                      fontSize: { xs: "1rem", sm: "1.25rem" },
                      fontWeight: "bold",
                    }}
                  >
                    <Money amount={totalExpenses} />
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    bgcolor: "rgba(76, 175, 80, 0.08)",
                    borderRadius: 1,
                    height: "100%",
                  }}
                >
                  <Typography
                    variant="caption"
                    display="block"
                    color="text.secondary"
                    sx={{ fontSize: { xs: "0.7rem", sm: "0.75rem" } }}
                  >
                    Total Deducible
                  </Typography>
                  <Typography
                    variant="h6"
                    color="success.main"
                    sx={{
                      fontSize: { xs: "1rem", sm: "1.25rem" },
                      fontWeight: "bold",
                    }}
                  >
                    <Money amount={deductibleTotal} />
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Paper>

      {/* Expenses List - Compact Design */}
      <Paper sx={{ p: 0, overflow: "hidden" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : sortedExpenses.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              No se encontraron gastos
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setDialogOpen(true)}
              sx={{ mt: 2, minHeight: 48 }}
            >
              Añadir Gasto
            </Button>
          </Box>
        ) : (
          <Stack divider={<Divider />}>
            {sortedExpenses.map((expense) => (
              <Box
                key={expense.id}
                sx={{
                  p: { xs: 2, sm: 2.5 },
                  display: "flex",
                  gap: 2,
                  alignItems: "center",
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                  transition: "background-color 0.2s",
                }}
              >
                {/* Main content area */}
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  {/* First row: Property Address, Date, Category, Deducible */}
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    flexWrap="wrap"
                    sx={{ mb: 0.5, gap: 0.5 }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight="medium"
                      sx={{
                        fontSize: { xs: "0.875rem", sm: "0.95rem" },
                      }}
                    >
                      {getPropertyAddress(expense.propertyId)}
                    </Typography>
                    <Chip
                      label={formatDate(expense.date)}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: "0.7rem",
                        bgcolor: "primary.light",
                        color: "primary.contrastText",
                        fontWeight: "bold",
                      }}
                    />
                    <Chip
                      label={
                        categoryLabels[expense.category] || expense.category
                      }
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ height: 22, fontSize: "0.7rem" }}
                    />
                    {expense.isDeductible !== false && (
                      <Chip
                        label="Deducible"
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ height: 22, fontSize: "0.7rem" }}
                      />
                    )}
                  </Stack>

                  {/* Second row: Description */}
                  {expense.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: "vertical",
                        fontSize: { xs: "0.8rem", sm: "0.875rem" },
                        mb: 0.5,
                      }}
                    >
                      {expense.description}
                    </Typography>
                  )}

                  {/* Third row: Vendor & Invoice - Compact */}
                  <Stack direction="row" spacing={1} alignItems="center">
                    {expense.vendor && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: "0.7rem" }}
                      >
                        {expense.vendor}
                      </Typography>
                    )}
                    {expense.invoiceNumber && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontSize: "0.7rem" }}
                      >
                        • #{expense.invoiceNumber}
                      </Typography>
                    )}
                    {expense.attachmentUrl && (
                      <Tooltip title="Ver factura adjunta">
                        <AttachFileIcon
                          fontSize="small"
                          color="primary"
                          sx={{
                            fontSize: "0.9rem",
                            cursor: "pointer",
                            "&:hover": { opacity: 0.7 },
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const link = document.createElement("a");
                            link.href = expense.attachmentUrl!;
                            link.download = `factura-${
                              expense.invoiceNumber || "documento"
                            }`;
                            link.click();
                          }}
                        />
                      </Tooltip>
                    )}
                  </Stack>
                </Box>

                {/* Right: Amount & Actions */}
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    alignItems: { xs: "flex-end", sm: "center" },
                    gap: { xs: 1, sm: 2 },
                    flexShrink: 0,
                  }}
                >
                  <Typography
                    variant="h6"
                    color="error.main"
                    fontWeight="bold"
                    sx={{
                      fontSize: { xs: "1rem", sm: "1.25rem" },
                      minWidth: { xs: "auto", sm: 100 },
                      textAlign: "right",
                    }}
                  >
                    <Money amount={expense.amount} />
                  </Typography>

                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <Tooltip title="Editar">
                      <IconButton
                        onClick={() => handleEdit(expense)}
                        size="small"
                        sx={{ width: 40, height: 40 }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton
                        onClick={() => setDeleteId(expense.id)}
                        color="error"
                        size="small"
                        sx={{ width: 40, height: 40 }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>

      <ExpenseFormDialog
        open={dialogOpen}
        expense={editingExpense}
        properties={properties}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={deleteId !== null}
        title="Eliminar gasto"
        message="¿Estás seguro de que deseas eliminar este gasto? Esta acción no se puede deshacer."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </Box>
  );
}
