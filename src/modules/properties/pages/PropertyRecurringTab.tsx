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
  Divider,
  Tooltip,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { DatePicker } from "@mui/x-date-pickers";
import { RecurringExpense, Periodicity } from "../types";
import {
  createRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
} from "../api";
import { parseDate, toISOString, formatDate } from "@/utils/date";
import { Money } from "@/components/Money";

const schema = z.object({
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

type FormData = z.infer<typeof schema>;

const expenseTypeLabels: Record<string, string> = {
  community: "Comunidad",
  ibi: "IBI",
  insurance: "Seguro",
  garbage: "Basura",
  adminFee: "Honorarios Admin",
  other: "Otro",
};

const periodicityLabels: Record<Periodicity, string> = {
  monthly: "Mensual",
  quarterly: "Trimestral",
  yearly: "Anual",
};

interface PropertyRecurringTabProps {
  propertyId: string;
  expenses: RecurringExpense[];
  onSave: () => void;
}

export function PropertyRecurringTab({
  propertyId,
  expenses,
  onSave,
}: PropertyRecurringTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<RecurringExpense | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "community",
      amount: 0,
      periodicity: "monthly",
      nextDueDate: null,
      isDeductible: true,
      notes: "",
    },
  });

  const handleAdd = () => {
    reset({
      type: "community",
      amount: 0,
      periodicity: "monthly",
      nextDueDate: null,
      isDeductible: true,
      notes: "",
    });
    setEditingExpense(null);
    setDialogOpen(true);
  };

  const handleEdit = (expense: RecurringExpense) => {
    reset({
      type: expense.type,
      amount: expense.amount,
      periodicity: expense.periodicity,
      nextDueDate: parseDate(expense.nextDueDate),
      isDeductible: expense.isDeductible !== false,
      notes: expense.notes || "",
    });
    setEditingExpense(expense);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este gasto fijo?")) return;

    setLoading(true);
    try {
      await deleteRecurringExpense(id);
      onSave();
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
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

      if (editingExpense) {
        await updateRecurringExpense(editingExpense.id, expenseData);
      } else {
        await createRecurringExpense(expenseData);
      }

      setDialogOpen(false);
      onSave();
    } catch (error) {
      console.error("Error saving expense:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate total annual expense
  const totalAnnual = expenses.reduce((sum, exp) => {
    const multiplier =
      exp.periodicity === "monthly"
        ? 12
        : exp.periodicity === "quarterly"
        ? 4
        : 1;
    return sum + exp.amount * multiplier;
  }, 0);

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "stretch", sm: "center" },
          mb: 2,
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h6">Gastos Fijos</Typography>
          <Typography variant="body2" color="text.secondary">
            Total anual: <Money amount={totalAnnual} />
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          sx={{
            minHeight: 48,
            width: { xs: "100%", sm: "auto" },
          }}
        >
          Añadir Gasto
        </Button>
      </Box>

      {expenses.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              No hay gastos fijos registrados
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAdd}
              sx={{ mt: 2, minHeight: 48 }}
            >
              Añadir Primer Gasto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {expenses.map((expense) => (
            <Grid item xs={12} sm={6} md={4} key={expense.id}>
              <Card sx={{ height: "100%" }}>
                <CardContent>
                  {/* Type Badge */}
                  <Chip
                    label={expenseTypeLabels[expense.type] || expense.type}
                    color="primary"
                    sx={{ mb: 2 }}
                  />

                  {expense.isDeductible !== false && (
                    <Chip
                      label="Deducible"
                      color="success"
                      size="small"
                      variant="outlined"
                      sx={{ ml: 1, mb: 2 }}
                    />
                  )}

                  {/* Amount */}
                  <Typography
                    variant="h5"
                    color="error.main"
                    sx={{ fontWeight: "bold", mb: 1 }}
                  >
                    <Money amount={expense.amount} />
                  </Typography>

                  {/* Periodicity */}
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1.5 }}
                  >
                    {periodicityLabels[expense.periodicity]}
                  </Typography>

                  <Divider sx={{ my: 1.5 }} />

                  {/* Annual Cost */}
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    sx={{ mb: 1 }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Coste anual:
                    </Typography>
                    <Typography variant="caption" fontWeight="bold">
                      <Money
                        amount={
                          expense.amount *
                          (expense.periodicity === "monthly"
                            ? 12
                            : expense.periodicity === "quarterly"
                            ? 4
                            : 1)
                        }
                      />
                    </Typography>
                  </Stack>

                  {/* Next Due Date */}
                  {expense.nextDueDate && (
                    <Typography variant="caption" color="text.secondary">
                      Próximo: {formatDate(expense.nextDueDate)}
                    </Typography>
                  )}

                  {/* Notes */}
                  {expense.notes && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1, fontStyle: "italic" }}
                    >
                      {expense.notes}
                    </Typography>
                  )}
                </CardContent>

                {/* Actions */}
                <Divider />
                <Box sx={{ display: "flex", justifyContent: "flex-end", p: 1 }}>
                  <Tooltip title="Editar">
                    <IconButton
                      onClick={() => handleEdit(expense)}
                      sx={{ minWidth: 48, minHeight: 48 }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Eliminar">
                    <IconButton
                      onClick={() => handleDelete(expense.id)}
                      color="error"
                      sx={{ minWidth: 48, minHeight: 48 }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {editingExpense ? "Editar Gasto Fijo" : "Nuevo Gasto Fijo"}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label="Tipo"
                  {...register("type")}
                  error={!!errors.type}
                  helperText={errors.type?.message}
                >
                  {Object.entries(expenseTypeLabels).map(([value, label]) => (
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
                  {...register("amount", { valueAsNumber: true })}
                  error={!!errors.amount}
                  helperText={errors.amount?.message}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Periodicidad"
                  {...register("periodicity")}
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
                  control={control}
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
                  {...register("notes")}
                />
              </Grid>

              {/* Is Deductible Checkbox */}
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Controller
                      name="isDeductible"
                      control={control}
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
            <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
