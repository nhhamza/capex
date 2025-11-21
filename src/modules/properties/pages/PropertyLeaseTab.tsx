import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box,
  Grid,
  TextField,
  Button,
  Typography,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Card,
  CardContent,
  CardActions,
  Chip,
  Stack,
  Tooltip,
  Alert,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonIcon from "@mui/icons-material/Person";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DownloadIcon from "@mui/icons-material/Download";
import { Lease } from "../types";
import { getLeases, createLease, updateLease, deleteLease } from "../api";
import { parseDate, toISOString, formatDate } from "@/utils/date";
import { formatCurrency } from "@/utils/format";

const schema = z.object({
  tenantName: z.string().min(1, "Nombre del inquilino requerido"),
  tenantPhone: z.string().optional(),
  tenantDNI: z.string().optional(),
  tenantEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  startDate: z.any().refine((d) => !!d && (d.isValid ? d.isValid() : true), {
    message: "Fecha de inicio requerida y válida",
  }),
  endDate: z.any().optional(),
  monthlyRent: z.number().min(1, "Renta requerida"),
  deposit: z.number().optional(),
  indexationRule: z.enum(["none", "ipc", "cap3", "custom"]),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

interface PropertyLeaseTabProps {
  propertyId: string;
  lease: Lease | null; // Keep for backward compatibility but we'll fetch all
  onSave: () => void;
}

export function PropertyLeaseTab({
  propertyId,
  onSave,
}: PropertyLeaseTabProps) {
  const [leases, setLeases] = useState<Lease[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLease, setEditingLease] = useState<Lease | null>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [existingContract, setExistingContract] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadLeases = async () => {
    const allLeases = await getLeases(propertyId);
    setLeases(allLeases);
  };

  useEffect(() => {
    loadLeases();
  }, [propertyId]);

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
      tenantName: "",
      tenantPhone: "",
      tenantDNI: "",
      tenantEmail: "",
      startDate: null,
      endDate: null,
      monthlyRent: 0,
      deposit: 0,
      indexationRule: "none",
      notes: "",
      isActive: true,
    });
    setEditingLease(null);
    setContractFile(null);
    setExistingContract("");
    setDialogOpen(true);
  };

  const handleEdit = (lease: Lease) => {
    reset({
      tenantName: lease.tenantName || "",
      tenantPhone: lease.tenantPhone || "",
      tenantDNI: lease.tenantDNI || "",
      tenantEmail: lease.tenantEmail || "",
      startDate: parseDate(lease.startDate),
      endDate: parseDate(lease.endDate),
      monthlyRent: lease.monthlyRent,
      deposit: lease.deposit || 0,
      indexationRule: lease.indexationRule || "none",
      notes: lease.notes || "",
      isActive: lease.isActive !== false,
    });
    setEditingLease(lease);
    setContractFile(null);
    setExistingContract(lease.contractUrl || "");
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("¿Estás seguro de eliminar este contrato?")) {
      await deleteLease(id);
      loadLeases();
      onSave();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError("El archivo es demasiado grande. Máximo 10MB.");
        return;
      }
      setContractFile(file);
      setError("");
    }
  };

  const handleRemoveFile = () => {
    setContractFile(null);
    setExistingContract("");
  };

  const handleDownloadContract = (url: string, tenantName: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `contrato-${tenantName.replace(/\s/g, "-")}`;
    link.click();
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
      let contractUrl = existingContract;

      if (contractFile) {
        contractUrl = await fileToBase64(contractFile);
      }

      const startIso = toISOString(data.startDate);
      if (!startIso) {
        setError("Fecha de inicio inválida");
        setLoading(false);
        return;
      }
      const endIso = toISOString(data.endDate);
      const leaseData = {
        propertyId,
        tenantName: data.tenantName,
        tenantPhone: data.tenantPhone,
        tenantDNI: data.tenantDNI,
        tenantEmail: data.tenantEmail,
        startDate: startIso,
        endDate: endIso,
        monthlyRent: data.monthlyRent,
        deposit: data.deposit,
        indexationRule: data.indexationRule,
        vacancyPct: 0, // Vacancy will be calculated automáticamente
        contractUrl: contractUrl || undefined,
        notes: data.notes,
        isActive: data.isActive,
      };

      if (editingLease) {
        await updateLease(editingLease.id, leaseData);
      } else {
        await createLease(leaseData);
      }

      setDialogOpen(false);
      loadLeases();
      onSave();
    } catch (err) {
      setError("Error al guardar el contrato. Por favor, inténtalo de nuevo.");
      console.error("Error saving lease:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h6">Contratos de Arrendamiento</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Nuevo Contrato
        </Button>
      </Box>

      {leases.length === 0 ? (
        <Alert severity="info">
          No hay contratos registrados. Haz clic en "Nuevo Contrato" para añadir
          uno.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {leases.map((lease) => (
            <Grid item xs={12} md={6} key={lease.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                    <PersonIcon sx={{ mr: 1, color: "primary.main" }} />
                    <Typography variant="h6">
                      {lease.tenantName || "Sin nombre"}
                    </Typography>
                    {lease.isActive !== false && (
                      <Chip
                        label="Activo"
                        color="success"
                        size="small"
                        sx={{ ml: "auto" }}
                      />
                    )}
                  </Box>

                  <Stack spacing={1}>
                    {lease.tenantPhone && (
                      <Typography variant="body2">
                        <strong>Teléfono:</strong> {lease.tenantPhone}
                      </Typography>
                    )}
                    {lease.tenantDNI && (
                      <Typography variant="body2">
                        <strong>DNI:</strong> {lease.tenantDNI}
                      </Typography>
                    )}
                    {lease.tenantEmail && (
                      <Typography variant="body2">
                        <strong>Email:</strong> {lease.tenantEmail}
                      </Typography>
                    )}
                    <Typography variant="body2">
                      <strong>Fecha inicio:</strong>{" "}
                      {formatDate(lease.startDate)}
                    </Typography>
                    {lease.endDate && (
                      <Typography variant="body2">
                        <strong>Fecha fin:</strong> {formatDate(lease.endDate)}
                      </Typography>
                    )}
                    <Typography variant="body2">
                      <strong>Renta mensual:</strong>{" "}
                      {formatCurrency(lease.monthlyRent)}
                    </Typography>
                    {lease.deposit && (
                      <Typography variant="body2">
                        <strong>Fianza:</strong> {formatCurrency(lease.deposit)}
                      </Typography>
                    )}
                    {lease.contractUrl && (
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <AttachFileIcon fontSize="small" color="primary" />
                        <Typography variant="body2" color="primary">
                          Contrato adjunto
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
                <CardActions sx={{ justifyContent: "flex-end" }}>
                  {lease.contractUrl && (
                    <Tooltip title="Descargar contrato">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() =>
                          handleDownloadContract(
                            lease.contractUrl!,
                            lease.tenantName || "contrato"
                          )
                        }
                      >
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Editar">
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleEdit(lease)}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Eliminar">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(lease.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>
            {editingLease
              ? "Editar Contrato"
              : "Nuevo Contrato de Arrendamiento"}
          </DialogTitle>

          <DialogContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom color="primary">
                  Datos del Inquilino
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nombre completo *"
                  {...register("tenantName")}
                  error={!!errors.tenantName}
                  helperText={errors.tenantName?.message}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Teléfono"
                  {...register("tenantPhone")}
                  helperText="Ej: +34 612 345 678"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="DNI/NIE"
                  {...register("tenantDNI")}
                  helperText="Documento de identidad"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  {...register("tenantEmail")}
                  error={!!errors.tenantEmail}
                  helperText={errors.tenantEmail?.message}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  color="primary"
                  sx={{ mt: 2 }}
                >
                  Detalles del Contrato
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="startDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      label="Fecha de Inicio *"
                      value={field.value}
                      onChange={field.onChange}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          required: true,
                          error: !!errors.startDate,
                        },
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="endDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      label="Fecha de Fin (opcional)"
                      value={field.value}
                      onChange={field.onChange}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Renta Mensual (€) *"
                  type="number"
                  {...register("monthlyRent", { valueAsNumber: true })}
                  error={!!errors.monthlyRent}
                  helperText={errors.monthlyRent?.message}
                  inputProps={{ step: 0.01, min: 0 }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Fianza (€)"
                  type="number"
                  {...register("deposit", { valueAsNumber: true })}
                  inputProps={{ step: 0.01, min: 0 }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Regla de Indexación"
                  {...register("indexationRule")}
                >
                  <MenuItem value="none">Ninguna</MenuItem>
                  <MenuItem value="ipc">IPC</MenuItem>
                  <MenuItem value="cap3">Cap 3%</MenuItem>
                  <MenuItem value="custom">Personalizada</MenuItem>
                </TextField>
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
                    Adjuntar Contrato Escaneado
                  </Typography>

                  {!contractFile && !existingContract ? (
                    <Box>
                      <input
                        accept="image/*,.pdf"
                        style={{ display: "none" }}
                        id="contract-file-upload"
                        type="file"
                        onChange={handleFileChange}
                      />
                      <label htmlFor="contract-file-upload">
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
                        Sube el contrato escaneado (máx. 10MB)
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <AttachFileIcon color="primary" />
                      <Typography variant="body2" sx={{ flexGrow: 1 }}>
                        {contractFile
                          ? contractFile.name
                          : "Contrato adjuntado"}
                      </Typography>
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
                <TextField
                  fullWidth
                  label="Notas adicionales"
                  {...register("notes")}
                  multiline
                  rows={2}
                  helperText="Información adicional sobre el contrato"
                />
              </Grid>

              <Grid item xs={12}>
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <Box>
                      <TextField
                        fullWidth
                        select
                        label="Estado del contrato"
                        value={field.value ? "active" : "inactive"}
                        onChange={(e) =>
                          field.onChange(e.target.value === "active")
                        }
                      >
                        <MenuItem value="active">Activo</MenuItem>
                        <MenuItem value="inactive">Inactivo/Histórico</MenuItem>
                      </TextField>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 0.5, display: "block" }}
                      >
                        Marca como "Activo" el contrato vigente. Los cálculos de
                        rentabilidad usarán el contrato activo.
                      </Typography>
                    </Box>
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
