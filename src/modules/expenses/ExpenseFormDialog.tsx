import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Alert,
  Box,
  IconButton,
  Typography,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import { OneOffExpense, Property } from "@/modules/properties/types";
import {
  createOneOffExpense,
  updateOneOffExpense,
} from "@/modules/properties/api";
import { parseDate, toISOString } from "@/utils/date";

const schema = z.object({
  propertyId: z.string().min(1, "Vivienda requerida"),
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

interface ExpenseFormDialogProps {
  open: boolean;
  expense: OneOffExpense | null;
  properties: Property[];
  onClose: () => void;
  onSave: () => void;
}

export function ExpenseFormDialog({
  open,
  expense,
  properties,
  onClose,
  onSave,
}: ExpenseFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [existingAttachment, setExistingAttachment] = useState<string>("");

  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (open) {
      if (expense) {
        reset({
          propertyId: expense.propertyId,
          date: parseDate(expense.date),
          amount: expense.amount,
          category: expense.category,
          description: expense.description || "",
          vendor: expense.vendor || "",
          invoiceNumber: expense.invoiceNumber || "",
          isDeductible: expense.isDeductible !== false,
          notes: expense.notes || "",
        });
        setExistingAttachment(expense.attachmentUrl || "");
        setAttachmentFile(null);
      } else {
        reset({
          propertyId: properties[0]?.id || "",
          date: null,
          amount: 0,
          category: "repair",
          description: "",
          vendor: "",
          invoiceNumber: "",
          isDeductible: true,
          notes: "",
        });
        setExistingAttachment("");
        setAttachmentFile(null);
      }
    }
  }, [open, expense, properties, reset]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("El archivo es demasiado grande. Máximo 5MB.");
        return;
      }
      setAttachmentFile(file);
      setError("");
    }
  };

  const handleRemoveFile = () => {
    setAttachmentFile(null);
    setExistingAttachment("");
  };

  const handleDownloadAttachment = () => {
    if (existingAttachment) {
      const link = document.createElement("a");
      link.href = existingAttachment;
      link.download = `factura-${expense?.invoiceNumber || "documento"}`;
      link.click();
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");

    try {
      let attachmentUrl = existingAttachment;

      // Convert file to base64 if a new file was uploaded
      if (attachmentFile) {
        attachmentUrl = await fileToBase64(attachmentFile);
      }

      const expenseData = {
        propertyId: data.propertyId,
        date: toISOString(data.date)!,
        amount: data.amount,
        category: data.category,
        description: data.description,
        vendor: data.vendor,
        invoiceNumber: data.invoiceNumber,
        attachmentUrl: attachmentUrl || undefined,
        isDeductible: data.isDeductible,
        notes: data.notes,
      };

      if (expense) {
        await updateOneOffExpense(expense.id, expenseData);
      } else {
        await createOneOffExpense(expenseData);
      }

      onSave();
    } catch (err) {
      setError("Error al guardar el gasto. Por favor, inténtalo de nuevo.");
      console.error("Error saving expense:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>
          {expense ? "Editar Gasto" : "Nuevo Gasto o Reparación"}
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Vivienda *"
                {...register("propertyId")}
                error={!!errors.propertyId}
                helperText={errors.propertyId?.message}
              >
                {properties.map((prop) => (
                  <MenuItem key={prop.id} value={prop.id}>
                    {prop.address}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Controller
                name="date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    label="Fecha del Gasto *"
                    value={field.value}
                    onChange={field.onChange}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        required: true,
                        error: !!errors.date,
                        helperText: errors.date?.message as string,
                      },
                    }}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Categoría *"
                {...register("category")}
                error={!!errors.category}
                helperText={errors.category?.message}
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Importe (€) *"
                type="number"
                {...register("amount", { valueAsNumber: true })}
                error={!!errors.amount}
                helperText={errors.amount?.message}
                inputProps={{ step: 0.01, min: 0 }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Descripción *"
                {...register("description")}
                error={!!errors.description}
                helperText={
                  errors.description?.message ||
                  "Ej: Reparación de tubería, Pintura salón, etc."
                }
                multiline
                rows={2}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Proveedor"
                {...register("vendor")}
                helperText="Nombre del proveedor o empresa"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nº Factura"
                {...register("invoiceNumber")}
                helperText="Número de factura o albarán"
              />
            </Grid>

            <Grid item xs={12}>
              <Box
                sx={{
                  border: "1px dashed",
                  borderColor: "divider",
                  borderRadius: 1,
                  p: 2,
                }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  Adjuntar Factura/Documento
                </Typography>

                {!attachmentFile && !existingAttachment ? (
                  <Box>
                    <input
                      accept="image/*,.pdf"
                      style={{ display: "none" }}
                      id="invoice-file-upload"
                      type="file"
                      onChange={handleFileChange}
                    />
                    <label htmlFor="invoice-file-upload">
                      <Button
                        variant="outlined"
                        component="span"
                        startIcon={<AttachFileIcon />}
                        size="small"
                      >
                        Seleccionar archivo
                      </Button>
                    </label>
                    <Typography
                      variant="caption"
                      display="block"
                      sx={{ mt: 1, color: "text.secondary" }}
                    >
                      Sube una imagen o PDF de la factura (máx. 5MB)
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <AttachFileIcon color="primary" />
                    <Typography variant="body2" sx={{ flexGrow: 1 }}>
                      {attachmentFile
                        ? attachmentFile.name
                        : "Factura adjuntada"}
                    </Typography>
                    {existingAttachment && !attachmentFile && (
                      <IconButton
                        size="small"
                        onClick={handleDownloadAttachment}
                        color="primary"
                      >
                        <DownloadIcon />
                      </IconButton>
                    )}
                    <IconButton
                      size="small"
                      onClick={handleRemoveFile}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                )}
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Controller
                name="isDeductible"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={field.value}
                        onChange={field.onChange}
                      />
                    }
                    label="Gasto deducible para Hacienda"
                  />
                )}
              />
              <Alert severity="info" sx={{ mt: 1 }}>
                <Box component="span" sx={{ fontSize: "0.875rem" }}>
                  <strong>Nota fiscal:</strong> Marca como deducible los gastos
                  que puedes desgravar en la declaración de la renta
                  (reparaciones, mantenimiento, seguros, comunidad, IBI, etc.).
                  Las mejoras que aumentan el valor del inmueble normalmente no
                  son deducibles.
                </Box>
              </Alert>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notas adicionales"
                {...register("notes")}
                multiline
                rows={2}
                helperText="Información adicional sobre el gasto"
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
