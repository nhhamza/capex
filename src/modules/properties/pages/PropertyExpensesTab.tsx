import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  IconButton,
  Card,
  CardContent,
  Chip,
  Stack,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  Menu,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DownloadIcon from "@mui/icons-material/Download";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import RepeatIcon from "@mui/icons-material/Repeat";
import EventIcon from "@mui/icons-material/Event";
import { DatePicker } from "@mui/x-date-pickers";
import { RecurringExpense, OneOffExpense, Periodicity } from "../types";
import {
  createRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
  createOneOffExpense,
  updateOneOffExpense,
  deleteOneOffExpense,
  uploadCapexAttachment,
} from "../api";
import { parseDate, toISOString, formatDate } from "@/utils/date";
import { Money } from "@/components/Money";

// Schema for recurring expenses
const recurringSchema = z.object({
  type: z.enum([
    "community",
    "ibi",
    "insurance",
    "garbage",
    "adminFee",
    "other",
  ]),
  amount: z.number().min(0.01, "Importe requerido"),
  periodicity: z.enum(["monthly", "quarterly", "yearly"]),
  nextDueDate: z.any().optional(),
  isDeductible: z.boolean().optional(),
  notes: z.string().optional(),
});

// Schema for one-off expenses
const capexSchema = z.object({
  date: z.any(),
  amount: z.number().min(0.01, "Importe requerido"),
  category: z.enum([
    "renovation",
    "repair",
    "maintenance",
    "furniture",
    "appliance",
    "improvement",
    "legal",
    "agency",
    "other",
  ]),
  description: z.string().min(1, "Descripción requerida"),
  vendor: z.string().optional(),
  invoiceNumber: z.string().optional(),
  isDeductible: z.boolean().optional(),
  notes: z.string().optional(),
  attachmentUrl: z.string().optional(),
  attachmentName: z.string().optional(),
});

type RecurringFormData = z.infer<typeof recurringSchema>;
type CapexFormData = z.infer<typeof capexSchema>;

const recurringTypeLabels: Record<string, string> = {
  community: "Comunidad",
  ibi: "IBI",
  insurance: "Seguro",
  garbage: "Basura",
  adminFee: "Honorarios Admin",
  other: "Otro",
};

const capexCategoryLabels: Record<string, string> = {
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

const periodicityLabels: Record<Periodicity, string> = {
  monthly: "Mensual",
  quarterly: "Trimestral",
  yearly: "Anual",
};

type ExpenseFilter = "all" | "recurring" | "capex";

interface PropertyExpensesTabProps {
  propertyId: string;
  recurring: RecurringExpense[];
  capex: OneOffExpense[];
  onSave: () => void;
}

export function PropertyExpensesTab({
  propertyId,
  recurring,
  capex,
  onSave,
}: PropertyExpensesTabProps) {
  const [filter, setFilter] = useState<ExpenseFilter>("all");
  const [dialogType, setDialogType] = useState<"recurring" | "capex" | null>(
    null
  );
  const [editingRecurring, setEditingRecurring] =
    useState<RecurringExpense | null>(null);
  const [editingCapex, setEditingCapex] = useState<OneOffExpense | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const [addMenuAnchor, setAddMenuAnchor] = useState<null | HTMLElement>(null);

  // Recurring expense form
  const recurringForm = useForm<RecurringFormData>({
    resolver: zodResolver(recurringSchema),
    defaultValues: {
      type: "community",
      amount: 0,
      periodicity: "monthly",
      nextDueDate: null,
      isDeductible: true,
      notes: "",
    },
  });

  // Capex form
  const capexForm = useForm<CapexFormData>({
    resolver: zodResolver(capexSchema),
    defaultValues: {
      date: null,
      amount: 0,
      category: "repair",
      description: "",
      vendor: "",
      invoiceNumber: "",
      isDeductible: true,
      notes: "",
      attachmentUrl: "",
      attachmentName: "",
    },
  });

  // Unified expense list
  type UnifiedExpense = (
    | ({ expenseType: "recurring" } & RecurringExpense)
    | ({ expenseType: "capex" } & OneOffExpense)
  ) & {
    sortDate: Date;
  };

  const unifiedExpenses: UnifiedExpense[] = [
    ...recurring.map((exp) => ({
      ...exp,
      expenseType: "recurring" as const,
      sortDate: exp.nextDueDate ? new Date(exp.nextDueDate) : new Date(0),
    })),
    ...capex.map((exp) => ({
      ...exp,
      expenseType: "capex" as const,
      sortDate: new Date(exp.date),
    })),
  ].sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());

  const filteredExpenses = unifiedExpenses.filter((exp) => {
    if (filter === "all") return true;
    return exp.expenseType === filter;
  });

  // Calculate totals
  const totalRecurringAnnual = recurring.reduce((sum, exp) => {
    const multiplier =
      exp.periodicity === "monthly"
        ? 12
        : exp.periodicity === "quarterly"
          ? 4
          : 1;
    return sum + exp.amount * multiplier;
  }, 0);

  const totalCapex = capex.reduce((sum, exp) => sum + exp.amount, 0);

  // Handlers
  const handleAddRecurring = () => {
    recurringForm.reset({
      type: "community",
      amount: 0,
      periodicity: "monthly",
      nextDueDate: null,
      isDeductible: true,
      notes: "",
    });
    setEditingRecurring(null);
    setDialogType("recurring");
    setAddMenuAnchor(null);
  };

  const handleAddCapex = () => {
    capexForm.reset({
      date: null,
      amount: 0,
      category: "repair",
      description: "",
      vendor: "",
      invoiceNumber: "",
      isDeductible: true,
      notes: "",
      attachmentUrl: "",
      attachmentName: "",
    });
    setEditingCapex(null);
    setUploadedFile(null);
    setDialogType("capex");
    setAddMenuAnchor(null);
  };

  const handleEditRecurring = (expense: RecurringExpense) => {
    recurringForm.reset({
      type: expense.type,
      amount: expense.amount,
      periodicity: expense.periodicity,
      nextDueDate: parseDate(expense.nextDueDate),
      isDeductible: expense.isDeductible !== false,
      notes: expense.notes || "",
    });
    setEditingRecurring(expense);
    setDialogType("recurring");
  };

  const handleEditCapex = (expense: OneOffExpense) => {
    capexForm.reset({
      date: parseDate(expense.date),
      amount: expense.amount,
      category: expense.category,
      description: expense.description || "",
      vendor: expense.vendor || "",
      invoiceNumber: expense.invoiceNumber || "",
      isDeductible: expense.isDeductible !== false,
      notes: expense.notes || "",
      attachmentUrl: expense.attachmentUrl || "",
      attachmentName: expense.attachmentName || "",
    });
    if (expense.attachmentUrl) {
      setUploadedFile({
        name: expense.attachmentName || "archivo",
        url: expense.attachmentUrl,
      });
    } else {
      setUploadedFile(null);
    }
    setEditingCapex(expense);
    setDialogType("capex");
  };

  const handleDeleteRecurring = async (id: string) => {
    if (!confirm("¿Eliminar este gasto fijo?")) return;
    setLoading(true);
    try {
      await deleteRecurringExpense(id);
      onSave();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCapex = async (id: string) => {
    if (!confirm("¿Eliminar este gasto puntual?")) return;
    setLoading(true);
    try {
      await deleteOneOffExpense(id);
      onSave();
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setUploading(true);
    try {
      const file = e.target.files[0];
      const attachment = await uploadCapexAttachment(
        propertyId,
        file,
        file.name
      );
      setUploadedFile({ name: attachment.name, url: attachment.url });
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Error al subir el archivo";
      console.error("Error uploading file:", err);
      alert(errorMsg);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleFileDelete = () => {
    if (!confirm("¿Eliminar el archivo adjunto?")) return;
    setUploadedFile(null);
  };

  const onSubmitRecurring = async (data: RecurringFormData) => {
    setLoading(true);
    try {
      const expenseData = {
        propertyId,
        type: data.type,
        amount: data.amount,
        periodicity: data.periodicity,
        nextDueDate: toISOString(data.nextDueDate),
        isDeductible: data.isDeductible,
        notes: data.notes,
      };

      if (editingRecurring) {
        await updateRecurringExpense(editingRecurring.id, expenseData);
      } else {
        await createRecurringExpense(expenseData);
      }

      setDialogType(null);
      onSave();
    } catch (error) {
      console.error("Error saving recurring expense:", error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmitCapex = async (data: CapexFormData) => {
    setLoading(true);
    try {
      const expenseData = {
        propertyId,
        date: toISOString(data.date)!,
        amount: data.amount,
        category: data.category,
        description: data.description,
        vendor: data.vendor,
        invoiceNumber: data.invoiceNumber,
        isDeductible: data.isDeductible,
        notes: data.notes,
        attachmentUrl: uploadedFile?.url || undefined,
        attachmentName: uploadedFile?.name || undefined,
      };

      if (editingCapex) {
        await updateOneOffExpense(editingCapex.id, expenseData);
      } else {
        await createOneOffExpense(expenseData);
      }

      setDialogType(null);
      onSave();
    } catch (error) {
      console.error("Error saving capex expense:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {/* Header with filters and add button */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "stretch", sm: "center" },
          mb: 3,
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h6">Gastos</Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Fijos (anual): <Money amount={totalRecurringAnnual} />
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Puntuales: <Money amount={totalCapex} />
            </Typography>
          </Stack>
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems="stretch"
        >
          <ToggleButtonGroup
            value={filter}
            exclusive
            onChange={(_, newFilter) => {
              if (newFilter !== null) setFilter(newFilter);
            }}
            size="small"
            sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
          >
            <ToggleButton value="all">Todos</ToggleButton>
            <ToggleButton value="recurring">Fijos</ToggleButton>
            <ToggleButton value="capex">Puntuales</ToggleButton>
          </ToggleButtonGroup>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={(e) => setAddMenuAnchor(e.currentTarget)}
            sx={{
              minHeight: 48,
              width: { xs: "100%", sm: "auto" },
            }}
          >
            Añadir Gasto
          </Button>
        </Stack>
      </Box>

      {/* Add menu */}
      <Menu
        anchorEl={addMenuAnchor}
        open={Boolean(addMenuAnchor)}
        onClose={() => setAddMenuAnchor(null)}
      >
        <MenuItem onClick={handleAddRecurring}>
          <ListItemIcon>
            <RepeatIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Gasto Fijo</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleAddCapex}>
          <ListItemIcon>
            <EventIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Gasto Puntual</ListItemText>
        </MenuItem>
      </Menu>

      {/* Unified expense list */}
      {filteredExpenses.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              No hay gastos registrados
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={(e) => setAddMenuAnchor(e.currentTarget)}
              sx={{ mt: 2, minHeight: 48 }}
            >
              Añadir Primer Gasto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {filteredExpenses.map((expense) => {
            if (expense.expenseType === "recurring") {
              const exp = expense as RecurringExpense & {
                expenseType: "recurring";
              };
              const annualAmount =
                exp.amount *
                (exp.periodicity === "monthly"
                  ? 12
                  : exp.periodicity === "quarterly"
                    ? 4
                    : 1);

              return (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  lg={4}
                  xl={3}
                  key={`recurring-${exp.id}`}
                >
                  <Card
                    sx={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      position: "relative",
                      transition: "box-shadow 0.2s",
                      "&:hover": {
                        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                      },
                      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                      borderRadius: 2,
                    }}
                  >
                    {/* Actions - always visible */}
                    <Box
                      sx={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        display: "flex",
                        gap: 0.5,
                        zIndex: 1,
                      }}
                    >
                      <Tooltip title="Editar">
                        <IconButton
                          onClick={() => handleEditRecurring(exp)}
                          size="small"
                          sx={{
                            bgcolor: "background.paper",
                            boxShadow: 1,
                            "&:hover": { bgcolor: "primary.lighter" },
                          }}
                        >
                          <EditIcon sx={{ fontSize: "1rem" }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton
                          onClick={() => handleDeleteRecurring(exp.id)}
                          size="small"
                          sx={{
                            bgcolor: "background.paper",
                            boxShadow: 1,
                            "&:hover": { bgcolor: "error.lighter" },
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: "1rem" }} />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    <CardContent sx={{ flexGrow: 1, p: 2, pt: 1.5 }}>
                      {/* Header with badges */}
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ mb: 1.5, flexWrap: "wrap", gap: 0.5, pr: 6 }}
                      >
                        <Chip
                          label="Fijo"
                          color="secondary"
                          size="small"
                          icon={<RepeatIcon sx={{ fontSize: "0.9rem" }} />}
                          sx={{ fontWeight: 600, height: 22 }}
                        />
                        <Chip
                          label={recurringTypeLabels[exp.type] || exp.type}
                          size="small"
                          sx={{
                            bgcolor: "primary.main",
                            color: "primary.contrastText",
                            fontWeight: 500,
                            height: 22,
                          }}
                        />
                        {exp.isDeductible !== false && (
                          <Chip
                            label="Deducible"
                            color="success"
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 500, height: 22 }}
                          />
                        )}
                      </Stack>

                      {/* Amount section - compact */}
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "baseline",
                          justifyContent: "space-between",
                          mb: 1.5,
                          p: 1.5,
                          bgcolor: "error.lighter",
                          borderRadius: 1,
                        }}
                      >
                        <Box>
                          <Typography
                            variant="caption"
                            sx={{
                              color: "error.dark",
                              fontWeight: 600,
                              fontSize: "0.65rem",
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                            }}
                          >
                            {periodicityLabels[exp.periodicity]}
                          </Typography>
                          <Typography
                            variant="h5"
                            sx={{
                              color: "error.main",
                              fontWeight: 700,
                              lineHeight: 1,
                            }}
                          >
                            <Money amount={exp.amount} />
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "right" }}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
                              fontWeight: 600,
                              fontSize: "0.6rem",
                              textTransform: "uppercase",
                            }}
                          >
                            Anual
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 700, color: "text.primary" }}
                          >
                            <Money amount={annualAmount} />
                          </Typography>
                        </Box>
                      </Box>

                      {/* Next due date - inline */}
                      {exp.nextDueDate && (
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            p: 1,
                            bgcolor: "grey.50",
                            borderRadius: 1,
                            mb: exp.notes ? 1.5 : 0,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              color: "text.secondary",
                              fontWeight: 600,
                              fontSize: "0.7rem",
                            }}
                          >
                            Próximo vencimiento
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 600, fontSize: "0.85rem" }}
                          >
                            {formatDate(exp.nextDueDate)}
                          </Typography>
                        </Box>
                      )}

                      {/* Notes - compact */}
                      {exp.notes && (
                        <Box
                          sx={{
                            p: 1,
                            bgcolor: "info.lighter",
                            borderLeft: "2px solid",
                            borderColor: "info.main",
                            borderRadius: 0.5,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              color: "info.dark",
                              fontStyle: "italic",
                              fontSize: "0.75rem",
                              lineHeight: 1.4,
                            }}
                          >
                            {exp.notes}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            } else {
              const exp = expense as OneOffExpense & { expenseType: "capex" };
              return (
                <Grid item xs={12} sm={6} lg={4} xl={3} key={`capex-${exp.id}`}>
                  <Card
                    sx={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      position: "relative",
                      transition: "box-shadow 0.2s",
                      "&:hover": {
                        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                      },
                      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    }}
                  >
                    {/* Date badge - compact */}
                    <Chip
                      label={formatDate(exp.date)}
                      size="small"
                      sx={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                        fontWeight: 700,
                        fontSize: "0.7rem",
                        height: 22,
                        zIndex: 1,
                      }}
                    />

                    {/* Actions - always visible */}
                    <Box
                      sx={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        display: "flex",
                        gap: 0.5,
                        zIndex: 1,
                      }}
                    >
                      <Tooltip title="Editar">
                        <IconButton
                          onClick={() => handleEditCapex(exp)}
                          size="small"
                          sx={{
                            bgcolor: "background.paper",
                            boxShadow: 1,
                            "&:hover": { bgcolor: "primary.lighter" },
                          }}
                        >
                          <EditIcon sx={{ fontSize: "1rem" }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar">
                        <IconButton
                          onClick={() => handleDeleteCapex(exp.id)}
                          size="small"
                          sx={{
                            bgcolor: "background.paper",
                            boxShadow: 1,
                            "&:hover": { bgcolor: "error.lighter" },
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: "1rem" }} />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    <CardContent sx={{ flexGrow: 1, p: 2, pt: 4.5 }}>
                      {/* Header with badges */}
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ mb: 1.5, flexWrap: "wrap", gap: 0.5 }}
                      >
                        <Chip
                          label="Puntual"
                          color="info"
                          size="small"
                          icon={<EventIcon sx={{ fontSize: "0.9rem" }} />}
                          sx={{ fontWeight: 600, height: 22 }}
                        />
                        <Chip
                          label={
                            capexCategoryLabels[exp.category] || exp.category
                          }
                          size="small"
                          sx={{
                            bgcolor: "primary.main",
                            color: "primary.contrastText",
                            fontWeight: 500,
                            height: 22,
                          }}
                        />
                        {exp.isDeductible !== false && (
                          <Chip
                            label="Deducible"
                            color="success"
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 500, height: 22 }}
                          />
                        )}
                      </Stack>

                      {/* Description - compact */}
                      <Typography
                        variant="body2"
                        sx={{
                          mb: 1.5,
                          fontWeight: 500,
                          lineHeight: 1.4,
                          color: "text.primary",
                          fontSize: "0.875rem",
                        }}
                      >
                        {exp.description}
                      </Typography>

                      {/* Amount section - compact */}
                      <Box
                        sx={{
                          p: 1.5,
                          bgcolor: "error.lighter",
                          borderRadius: 1,
                          mb: 1.5,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            color: "error.dark",
                            fontWeight: 600,
                            fontSize: "0.65rem",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                          }}
                        >
                          Importe
                        </Typography>
                        <Typography
                          variant="h5"
                          sx={{
                            color: "error.main",
                            fontWeight: 700,
                            lineHeight: 1,
                          }}
                        >
                          <Money amount={exp.amount} />
                        </Typography>
                      </Box>

                      {/* Details - compact inline */}
                      {(exp.vendor || exp.invoiceNumber) && (
                        <Stack spacing={0.75} sx={{ mb: 1.5 }}>
                          {exp.vendor && (
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                p: 1,
                                bgcolor: "grey.50",
                                borderRadius: 1,
                              }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  color: "text.secondary",
                                  fontWeight: 600,
                                  fontSize: "0.7rem",
                                }}
                              >
                                Proveedor
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600, fontSize: "0.85rem" }}
                              >
                                {exp.vendor}
                              </Typography>
                            </Box>
                          )}
                          {exp.invoiceNumber && (
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                p: 1,
                                bgcolor: "grey.50",
                                borderRadius: 1,
                              }}
                            >
                              <Typography
                                variant="caption"
                                sx={{
                                  color: "text.secondary",
                                  fontWeight: 600,
                                  fontSize: "0.7rem",
                                }}
                              >
                                Nº Factura
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600, fontSize: "0.85rem" }}
                              >
                                {exp.invoiceNumber}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      )}

                      {/* Notes - compact */}
                      {exp.notes && (
                        <Box
                          sx={{
                            p: 1,
                            bgcolor: "info.lighter",
                            borderLeft: "2px solid",
                            borderColor: "info.main",
                            borderRadius: 0.5,
                            mb: exp.attachmentUrl ? 1.5 : 0,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              color: "info.dark",
                              fontStyle: "italic",
                              fontSize: "0.75rem",
                              lineHeight: 1.4,
                            }}
                          >
                            {exp.notes}
                          </Typography>
                        </Box>
                      )}

                      {/* Attachment - compact */}
                      {exp.attachmentUrl && (
                        <Box
                          onClick={() => {
                            const a = document.createElement("a");
                            a.href = exp.attachmentUrl!;
                            a.download = exp.attachmentName || "archivo";
                            a.click();
                          }}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            p: 1,
                            bgcolor: "primary.lighter",
                            borderRadius: 1,
                            cursor: "pointer",
                            transition: "all 0.2s",
                            "&:hover": {
                              bgcolor: "primary.light",
                            },
                          }}
                        >
                          <AttachFileIcon
                            sx={{ color: "primary.main", fontSize: "1rem" }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              flexGrow: 1,
                              color: "primary.main",
                              fontWeight: 600,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: "0.75rem",
                            }}
                          >
                            {exp.attachmentName || "Archivo adjunto"}
                          </Typography>
                          <DownloadIcon
                            sx={{ color: "primary.main", fontSize: "1rem" }}
                          />
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            }
          })}
        </Grid>
      )}

      {/* Recurring Expense Dialog */}
      <Dialog
        open={dialogType === "recurring"}
        onClose={() => setDialogType(null)}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={recurringForm.handleSubmit(onSubmitRecurring)}>
          <DialogTitle>
            {editingRecurring ? "Editar Gasto Fijo" : "Nuevo Gasto Fijo"}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label="Tipo"
                  {...recurringForm.register("type")}
                  error={!!recurringForm.formState.errors.type}
                  helperText={recurringForm.formState.errors.type?.message}
                >
                  {Object.entries(recurringTypeLabels).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Importe"
                  type="number"
                  {...recurringForm.register("amount", { valueAsNumber: true })}
                  error={!!recurringForm.formState.errors.amount}
                  helperText={recurringForm.formState.errors.amount?.message}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Periodicidad"
                  {...recurringForm.register("periodicity")}
                >
                  {Object.entries(periodicityLabels).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="nextDueDate"
                  control={recurringForm.control}
                  render={({ field }) => (
                    <DatePicker
                      label="Próximo Vencimiento"
                      value={field.value}
                      onChange={field.onChange}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notas"
                  multiline
                  rows={2}
                  {...recurringForm.register("notes")}
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Controller
                      name="isDeductible"
                      control={recurringForm.control}
                      render={({ field }) => (
                        <Checkbox
                          {...field}
                          checked={field.value !== false}
                          onChange={(e) => field.onChange(e.target.checked)}
                        />
                      )}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      Gasto deducible fiscalmente (para Hacienda)
                    </Typography>
                  }
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogType(null)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Capex Dialog */}
      <Dialog
        open={dialogType === "capex"}
        onClose={() => setDialogType(null)}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={capexForm.handleSubmit(onSubmitCapex)}>
          <DialogTitle>
            {editingCapex ? "Editar Gasto Puntual" : "Nuevo Gasto Puntual"}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="date"
                  control={capexForm.control}
                  render={({ field }) => (
                    <DatePicker
                      label="Fecha"
                      value={field.value}
                      onChange={field.onChange}
                      slotProps={{
                        textField: { fullWidth: true, required: true },
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Importe"
                  type="number"
                  {...capexForm.register("amount", { valueAsNumber: true })}
                  error={!!capexForm.formState.errors.amount}
                  helperText={capexForm.formState.errors.amount?.message}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label="Categoría"
                  {...capexForm.register("category")}
                >
                  {Object.entries(capexCategoryLabels).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                      {label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Descripción"
                  {...capexForm.register("description")}
                  error={!!capexForm.formState.errors.description}
                  helperText={capexForm.formState.errors.description?.message}
                  multiline
                  rows={2}
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Proveedor"
                  {...capexForm.register("vendor")}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nº Factura"
                  {...capexForm.register("invoiceNumber")}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notas"
                  {...capexForm.register("notes")}
                  multiline
                  rows={2}
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Controller
                      name="isDeductible"
                      control={capexForm.control}
                      render={({ field }) => (
                        <Checkbox
                          {...field}
                          checked={field.value !== false}
                          onChange={(e) => field.onChange(e.target.checked)}
                        />
                      )}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      Gasto deducible fiscalmente (para Hacienda)
                    </Typography>
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Archivo adjunto (opcional)
                </Typography>
                {uploadedFile ? (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      p: 2,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                    }}
                  >
                    <AttachFileIcon color="action" />
                    <Typography variant="body2" sx={{ flexGrow: 1 }}>
                      {uploadedFile.name}
                    </Typography>
                    <Tooltip title="Descargar">
                      <IconButton
                        size="small"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = uploadedFile.url;
                          a.download = uploadedFile.name;
                          a.click();
                        }}
                      >
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={handleFileDelete}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                ) : (
                  <Button
                    component="label"
                    variant="outlined"
                    startIcon={
                      uploading ? (
                        <CircularProgress size={18} />
                      ) : (
                        <CloudUploadIcon />
                      )
                    }
                    disabled={uploading}
                  >
                    {uploading ? "Subiendo..." : "Subir archivo"}
                    <input
                      type="file"
                      hidden
                      accept="*"
                      onChange={handleFileChange}
                    />
                  </Button>
                )}
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogType(null)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
