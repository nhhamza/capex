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
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonIcon from "@mui/icons-material/Person";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DownloadIcon from "@mui/icons-material/Download";
import { Lease, Room, Property } from "../types";
import {
  getLeases,
  createLease,
  updateLease,
  deleteLease,
  getRooms,
} from "../api";
import { parseDate, toISOString, formatDate } from "@/utils/date";
import { getActiveUnitLease, getActiveRoomLease } from "@/utils/date";
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
  roomId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface PropertyLeaseTabProps {
  property: Property;
  lease: Lease | null;
  onSave: () => void;
  roomId?: string | null;
}

export function PropertyLeaseTab({
  property,
  onSave,
  roomId,
}: PropertyLeaseTabProps) {
  const propertyId = property.id;
  const rentalMode = property.rentalMode;

  const [leases, setLeases] = useState<Lease[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
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

  const loadRooms = async () => {
    if (rentalMode === "PER_ROOM") {
      const allRooms = await getRooms(propertyId);
      setRooms(allRooms);
    }
  };

  useEffect(() => {
    loadLeases();
    loadRooms();
  }, [propertyId, rentalMode]);

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
      roomId: undefined,
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
      roomId: lease.roomId,
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
        roomId: data.roomId,
      };

      // Business rule validation: only one active lease at a time
      if (!editingLease) {
        // Creating new lease
        if (!data.roomId) {
          // ENTIRE_UNIT lease
          const activeUnitLease = getActiveUnitLease(leases);
          if (activeUnitLease) {
            setError(
              "Ya existe un contrato activo para esta vivienda. Finaliza el contrato actual antes de crear uno nuevo."
            );
            setLoading(false);
            return;
          }
        } else {
          // PER_ROOM lease
          const activeRoomLease = getActiveRoomLease(leases, data.roomId);
          if (activeRoomLease) {
            setError(
              "Esta habitación ya tiene un contrato activo. Finaliza el contrato actual antes de crear uno nuevo."
            );
            setLoading(false);
            return;
          }
        }
      }

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

  const activeUnitLease = getActiveUnitLease(leases);

  return (
    <Box>
      {rentalMode === "ENTIRE_UNIT" ? (
        // MODO ENTIRE_UNIT: Comportamiento actual
        <>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 3,
            }}
          >
            <Typography variant="h6">Contrato de Arrendamiento</Typography>
            {activeUnitLease ? (
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  onClick={() => handleEdit(activeUnitLease)}
                >
                  Editar Contrato
                </Button>
                <Button
                  variant="contained"
                  onClick={() => handleEdit(activeUnitLease)}
                >
                  Finalizar Contrato
                </Button>
              </Stack>
            ) : (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAdd}
              >
                Nuevo Contrato
              </Button>
            )}
          </Box>

          {activeUnitLease ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Ya existe un contrato activo. Finaliza el contrato actual (pon
              fecha de fin) antes de crear uno nuevo.
            </Alert>
          ) : leases.length === 0 ? (
            <Alert severity="info">
              <Typography variant="body2" gutterBottom>
                No hay contratos registrados. Haz clic en "Nuevo Contrato" para
                añadir uno.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Solo puede haber 1 contrato activo para el piso. Para crear uno
                nuevo, primero finaliza el actual añadindo una fecha de fin del
                alquiler
              </Typography>
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {leases.map((lease) => (
                <Grid item xs={12} md={6} key={lease.id}>
                  <Card>
                    <CardContent>
                      <Box
                        sx={{ display: "flex", alignItems: "center", mb: 2 }}
                      >
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
                            <strong>Fecha fin:</strong>{" "}
                            {formatDate(lease.endDate)}
                          </Typography>
                        )}
                        <Typography variant="body2">
                          <strong>Renta mensual:</strong>{" "}
                          {formatCurrency(lease.monthlyRent)}
                        </Typography>
                        {lease.deposit && (
                          <Typography variant="body2">
                            <strong>Fianza:</strong>{" "}
                            {formatCurrency(lease.deposit)}
                          </Typography>
                        )}
                        {lease.contractUrl && (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
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
        </>
      ) : roomId ? (
        // MODO PER_ROOM con roomId específico: Mostrar contrato de esa habitación
        (() => {
          const room = rooms.find((r) => r.id === roomId);
          const roomLeases = leases.filter((l) => l.roomId === roomId);
          const activeLease = getActiveRoomLease(leases, roomId);

          return (
            <>
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Contrato - Habitación: {room?.name || "Desconocida"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Gestiona el contrato de arrendamiento para esta habitación
                  específica.
                </Typography>
              </Box>

              {activeLease ? (
                <>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    Esta habitación tiene un contrato activo. Para crear uno
                    nuevo, primero finaliza el contrato actual añadiendo una
                    fecha de fin de contrato.
                  </Alert>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Card>
                        <CardContent>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              mb: 2,
                            }}
                          >
                            <PersonIcon sx={{ mr: 1, color: "primary.main" }} />
                            <Typography variant="h6">
                              {activeLease.tenantName || "Sin nombre"}
                            </Typography>
                            <Chip
                              label="Activo"
                              color="success"
                              size="small"
                              sx={{ ml: "auto" }}
                            />
                          </Box>

                          <Stack spacing={1}>
                            {activeLease.tenantPhone && (
                              <Typography variant="body2">
                                <strong>Teléfono:</strong>{" "}
                                {activeLease.tenantPhone}
                              </Typography>
                            )}
                            {activeLease.tenantDNI && (
                              <Typography variant="body2">
                                <strong>DNI:</strong> {activeLease.tenantDNI}
                              </Typography>
                            )}
                            {activeLease.tenantEmail && (
                              <Typography variant="body2">
                                <strong>Email:</strong>{" "}
                                {activeLease.tenantEmail}
                              </Typography>
                            )}
                            <Typography variant="body2">
                              <strong>Fecha inicio:</strong>{" "}
                              {formatDate(activeLease.startDate)}
                            </Typography>
                            {activeLease.endDate && (
                              <Typography variant="body2">
                                <strong>Fecha fin:</strong>{" "}
                                {formatDate(activeLease.endDate)}
                              </Typography>
                            )}
                            <Typography variant="body2">
                              <strong>Renta mensual:</strong>{" "}
                              {formatCurrency(activeLease.monthlyRent)}
                            </Typography>
                            {activeLease.deposit && (
                              <Typography variant="body2">
                                <strong>Fianza:</strong>{" "}
                                {formatCurrency(activeLease.deposit)}
                              </Typography>
                            )}
                            {activeLease.contractUrl && (
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                }}
                              >
                                <AttachFileIcon
                                  fontSize="small"
                                  color="primary"
                                />
                                <Typography variant="body2" color="primary">
                                  Contrato adjunto
                                </Typography>
                              </Box>
                            )}
                          </Stack>
                        </CardContent>
                        <CardActions sx={{ justifyContent: "flex-end" }}>
                          {activeLease.contractUrl && (
                            <Tooltip title="Descargar contrato">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() =>
                                  handleDownloadContract(
                                    activeLease.contractUrl!,
                                    activeLease.tenantName || "contrato"
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
                              onClick={() => handleEdit(activeLease)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                        </CardActions>
                      </Card>
                    </Grid>
                  </Grid>
                </>
              ) : (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="body2" gutterBottom>
                      Esta habitación no tiene un contrato activo.
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => {
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
                          roomId: roomId, // Pre-fill roomId
                        });
                        setEditingLease(null);
                        setContractFile(null);
                        setExistingContract("");
                        setDialogOpen(true);
                      }}
                      sx={{ mt: 1 }}
                    >
                      Crear contrato para esta habitación
                    </Button>
                  </Alert>

                  {roomLeases.length > 0 && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Historial de contratos
                      </Typography>
                      <TableContainer component={Paper}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                              <TableCell sx={{ fontWeight: 600 }}>
                                Inquilino
                              </TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>
                                Renta
                              </TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>
                                Inicio
                              </TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>
                                Fin
                              </TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>
                                Estado
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {roomLeases.map((lease) => (
                              <TableRow key={lease.id}>
                                <TableCell>
                                  <Typography variant="body2">
                                    {lease.tenantName || "-"}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {formatCurrency(lease.monthlyRent)}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {formatDate(lease.startDate)}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {formatDate(lease.endDate)}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  {lease.isActive !== false ? (
                                    <Chip
                                      label="Activo"
                                      color="success"
                                      size="small"
                                    />
                                  ) : (
                                    <Chip label="Inactivo" size="small" />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}
                </>
              )}
            </>
          );
        })()
      ) : (
        // MODO PER_ROOM sin roomId: Mostrar mensaje para seleccionar habitación
        <>
          <Box sx={{ textAlign: "center", py: 6 }}>
            <Typography variant="h6" gutterBottom>
              Gestión de Contratos por Habitación
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Selecciona una habitación desde la pestaña "Habitaciones" para
              gestionar su contrato de arrendamiento.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Cada habitación puede tener solo 1 contrato activo a la vez.
            </Typography>
          </Box>
        </>
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

              {rentalMode === "PER_ROOM" && (
                <Grid item xs={12} sm={6}>
                  <Controller
                    name="roomId"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        select
                        label="Habitación"
                        fullWidth
                        disabled={!!roomId} // Disable if roomId is provided from URL
                        helperText={
                          roomId
                            ? "Habitación pre-seleccionada desde la URL"
                            : "Selecciona la habitación para este contrato"
                        }
                      >
                        <MenuItem value="">No asignada</MenuItem>
                        {rooms.map((room) => (
                          <MenuItem key={room.id} value={room.id}>
                            {room.name}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Grid>
              )}

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
