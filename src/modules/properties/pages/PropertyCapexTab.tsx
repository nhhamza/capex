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
  Card,
  CardContent,
  Chip,
  Stack,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DownloadIcon from "@mui/icons-material/Download";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { DatePicker } from "@mui/x-date-pickers";
import { OneOffExpense } from "../types";
import {
  createOneOffExpense,
  updateOneOffExpense,
  deleteOneOffExpense,
} from "../api";
import { parseDate, toISOString, formatDate } from "@/utils/date";
import { Money } from "@/components/Money";

const schema = z.object({
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

type FormData = z.infer<typeof schema>;

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

interface PropertyCapexTabProps {
  propertyId: string;
  expenses: OneOffExpense[];
  onSave: () => void;
}

export function PropertyCapexTab({
  propertyId,
  expenses,
  onSave,
}: PropertyCapexTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<OneOffExpense | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{
    name: string;
    url: string;
  } | null>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const handleAdd = () => {
    reset({
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
    setEditingExpense(null);
    setUploadedFile(null);
    setDialogOpen(true);
  };

  const handleEdit = (expense: OneOffExpense) => {
    reset({
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
    setEditingExpense(expense);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
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
      const file = e.target.files[0]; // Only take first file
      const base64Url = await fileToBase64(file);
      setUploadedFile({ name: file.name, url: base64Url });
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Error al subir el archivo");
    } finally {
      setUploading(false);
    }
  };

  const handleFileDelete = () => {
    if (!confirm("¿Eliminar el archivo adjunto?")) return;
    setUploadedFile(null);
  };

  const onSubmit = async (data: FormData) => {
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

      if (editingExpense) {
        await updateOneOffExpense(editingExpense.id, expenseData);
      } else {
        await createOneOffExpense(expenseData);
      }

      setDialogOpen(false);
      onSave();
    } catch (error) {
      console.error("Error saving expense:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate total expense
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Sort by date descending
  const sortedExpenses = [...expenses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

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
          <Typography variant="h6">Gastos Puntuales (CapEx)</Typography>
          <Typography variant="body2" color="text.secondary">
            Total: <Money amount={totalExpenses} />
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

      {sortedExpenses.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              No hay gastos puntuales registrados
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
          {sortedExpenses.map((expense) => (
            <Grid item xs={12} sm={6} md={4} key={expense.id}>
              <Card
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                }}
              >
                {/* Date Badge */}
                <Box
                  sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: "0.75rem",
                    fontWeight: "medium",
                  }}
                >
                  {formatDate(expense.date)}
                </Box>

                <CardContent sx={{ flexGrow: 1, pt: 5 }}>
                  {/* Category */}
                  <Chip
                    label={categoryLabels[expense.category] || expense.category}
                    color="primary"
                    size="small"
                    sx={{ mb: 1.5 }}
                  />

                  {expense.isDeductible !== false && (
                    <Chip
                      label="Deducible"
                      color="success"
                      size="small"
                      variant="outlined"
                      sx={{ ml: 1, mb: 1.5 }}
                    />
                  )}

                  {/* Description */}
                  <Typography variant="body2" sx={{ mb: 1.5, minHeight: 40 }}>
                    {expense.description}
                  </Typography>

                  {/* Amount */}
                  <Typography
                    variant="h5"
                    color="error.main"
                    sx={{ fontWeight: "bold", mb: 1.5 }}
                  >
                    <Money amount={expense.amount} />
                  </Typography>

                  <Divider sx={{ my: 1.5 }} />

                  {/* Details */}
                  <Stack spacing={0.5}>
                    {expense.vendor && (
                      <Typography variant="caption" color="text.secondary">
                        <strong>Proveedor:</strong> {expense.vendor}
                      </Typography>
                    )}
                    {expense.invoiceNumber && (
                      <Typography variant="caption" color="text.secondary">
                        <strong>Nº Factura:</strong> {expense.invoiceNumber}
                      </Typography>
                    )}
                    {expense.notes && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontStyle: "italic" }}
                      >
                        {expense.notes}
                      </Typography>
                    )}
                    {expense.attachmentUrl && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          mt: 1,
                        }}
                      >
                        <AttachFileIcon
                          sx={{ fontSize: "0.875rem" }}
                          color="action"
                        />
                        <Typography
                          variant="caption"
                          color="primary"
                          sx={{
                            textDecoration: "none",
                            cursor: "pointer",
                            "&:hover": { textDecoration: "underline" },
                          }}
                          onClick={() => {
                            const a = document.createElement("a");
                            a.href = expense.attachmentUrl!;
                            a.download = expense.attachmentName || "archivo";
                            a.click();
                          }}
                        >
                          {expense.attachmentName || "Archivo adjunto"}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </CardContent>

                {/* Actions */}
                <Divider />
                <Box sx={{ display: "flex", justifyContent: "flex-end", p: 1 }}>
                  {expense.attachmentUrl && (
                    <Tooltip title="Descargar archivo">
                      <IconButton
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = expense.attachmentUrl!;
                          a.download = expense.attachmentName || "archivo";
                          a.click();
                        }}
                        sx={{ minWidth: 48, minHeight: 48 }}
                      >
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                  )}
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
            {editingExpense ? "Editar Gasto Puntual" : "Nuevo Gasto Puntual"}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="date"
                  control={control}
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
                  {...register("amount", { valueAsNumber: true })}
                  error={!!errors.amount}
                  helperText={errors.amount?.message}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label="Categoría"
                  {...register("category")}
                >
                  {Object.entries(categoryLabels).map(([value, label]) => (
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
                  {...register("description")}
                  error={!!errors.description}
                  helperText={errors.description?.message}
                  multiline
                  rows={2}
                  required
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Proveedor"
                  {...register("vendor")}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nº Factura"
                  {...register("invoiceNumber")}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notas"
                  {...register("notes")}
                  multiline
                  rows={2}
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
