import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSearchParams } from "react-router-dom";
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
  const [searchParams, setSearchParams] = useSearchParams();

  // Helper to check if a lease is truly active (based on dates)
  const isLeaseTrulyActive = (lease: Lease) => {
    if (lease.isActive === false) return false;
    if (!lease.endDate) return true; // No end date means ongoing
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(lease.endDate);
    endDate.setHours(0, 0, 0, 0);
    return endDate >= today; // Active if end date is today or in the future
  };

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

  const handleRoomChange = (newRoomId: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (newRoomId) {
      newParams.set("roomId", newRoomId);
    } else {
      newParams.delete("roomId");
    }
    setSearchParams(newParams);
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
        createdAt: editingLease ? undefined : Date.now(), // Solo al crear nuevo contrato
      };

      // Business rule validation: only one active lease at a time
      if (!editingLease) {
        // Creating new lease
        if (!data.roomId) {
          // ENTIRE_UNIT lease - check if there's a truly active lease
          const activeUnitLease = leases
            .filter((l) => !l.roomId)
            .find((l) => isLeaseTrulyActive(l));
          if (activeUnitLease) {
            setError(
              "Ya existe un contrato activo para esta vivienda. Finaliza el contrato actual antes de crear uno nuevo."
            );
            setLoading(false);
            return;
          }
        } else {
          // PER_ROOM lease - check if there's a truly active lease for this room
          const activeRoomLease = leases
            .filter((l) => l.roomId === data.roomId)
            .find((l) => isLeaseTrulyActive(l));
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

  const activeUnitLease = leases
    .filter((l) => !l.roomId)
    .find((l) => isLeaseTrulyActive(l));

  return (
    <Box>
      {rentalMode === "ENTIRE_UNIT" ? (
        // MODO ENTIRE_UNIT
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
            {!activeUnitLease && (
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
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                Ya existe un contrato activo. Finaliza el contrato actual (pon
                fecha de fin) antes de crear uno nuevo.
              </Alert>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Box
                        sx={{ display: "flex", alignItems: "center", mb: 2 }}
                      >
                        <PersonIcon sx={{ mr: 1, color: "primary.main" }} />
                        <Typography variant="h6">
                          {activeUnitLease.tenantName || "Sin nombre"}
                        </Typography>
                        {isLeaseTrulyActive(activeUnitLease) ? (
                          <Chip
                            label="Activo"
                            color="success"
                            size="small"
                            sx={{ ml: "auto" }}
                          />
                        ) : (
                          <Chip
                            label="Finalizado"
                            color="default"
                            size="small"
                            sx={{ ml: "auto" }}
                          />
                        )}
                      </Box>

                      <Stack spacing={1}>
                        {activeUnitLease.tenantPhone && (
                          <Typography variant="body2">
                            <strong>Teléfono:</strong> {activeUnitLease.tenantPhone}
                          </Typography>
                        )}
                        {activeUnitLease.tenantDNI && (
                          <Typography variant="body2">
                            <strong>DNI:</strong> {activeUnitLease.tenantDNI}
                          </Typography>
                        )}
                        {activeUnitLease.tenantEmail && (
                          <Typography variant="body2">
                            <strong>Email:</strong> {activeUnitLease.tenantEmail}
                          </Typography>
                        )}
                        <Typography variant="body2">
                          <strong>Fecha inicio:</strong>{" "}
                          {formatDate(activeUnitLease.startDate)}
                        </Typography>
                        {activeUnitLease.endDate && (
                          <Typography variant="body2">
                            <strong>Fecha fin:</strong>{" "}
                            {formatDate(activeUnitLease.endDate)}
                          </Typography>
                        )}
                        <Typography variant="body2">
                          <strong>Renta mensual:</strong>{" "}
                          {formatCurrency(activeUnitLease.monthlyRent)}
                        </Typography>
                        {activeUnitLease.deposit && (
                          <Typography variant="body2">
                            <strong>Fianza:</strong>{" "}
                            {formatCurrency(activeUnitLease.deposit)}
                          </Typography>
                        )}
                        {activeUnitLease.contractUrl && (
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
                      {activeUnitLease.contractUrl && (
                        <Tooltip title="Descargar contrato">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() =>
                              handleDownloadContract(
                                activeUnitLease.contractUrl!,
                                activeUnitLease.tenantName || "contrato"
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
                          onClick={() => handleEdit(activeUnitLease)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Grid>
              </Grid>
            </>
          ) : leases.length === 0 ? (
            <Alert severity="info">
              <Typography variant="body2" gutterBottom>
                No hay contratos registrados. Haz clic en "Nuevo Contrato" para
                añadir uno.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Solo puede haber 1 contrato activo para el piso. Para crear uno
                nuevo, primero finaliza el actual añadiendo una fecha de fin del
                alquiler
              </Typography>
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                Esta vivienda no tiene un contrato activo.
              </Typography>
              <Button
                variant="contained"
                size="small"
                onClick={handleAdd}
                sx={{ mt: 1 }}
              >
                Crear nuevo contrato
              </Button>
            </Alert>
          )}

          {/* Historial de contratos - Always show if there are contracts */}
          {(() => {
            // Filter out active lease and sort by creation date (newest first)
            const historyLeases = leases
              .filter((l) => !l.roomId && l.id !== activeUnitLease?.id)
              .sort((a, b) => {
                const aDate = a.createdAt || 0;
                const bDate = b.createdAt || 0;
                return bDate - aDate;
              });

            return historyLeases.length > 0 ? (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Historial de contratos ({historyLeases.length})
                </Typography>
                {/* Mobile-friendly: Show cards on small screens */}
                <Box sx={{ display: { xs: "block", md: "none" } }}>
                  <Stack spacing={2}>
                    {historyLeases.map((lease) => (
                    <Card key={lease.id} variant="outlined">
                      <CardContent>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {lease.tenantName || "-"}
                          </Typography>
                          {isLeaseTrulyActive(lease) ? (
                            <Chip label="Activo" color="success" size="small" />
                          ) : (
                            <Chip label="Finalizado" size="small" />
                          )}
                        </Box>
                        <Stack spacing={0.5}>
                          <Typography variant="body2" color="text.secondary">
                            <strong>Renta:</strong> {formatCurrency(lease.monthlyRent)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            <strong>Inicio:</strong> {formatDate(lease.startDate)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            <strong>Fin:</strong> {formatDate(lease.endDate) || "Sin definir"}
                          </Typography>
                        </Stack>
                        <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
                          <Button size="small" variant="outlined" onClick={() => handleEdit(lease)}>
                            Editar
                          </Button>
                          {lease.contractUrl && (
                            <Button
                              size="small"
                              variant="text"
                              startIcon={<DownloadIcon />}
                              onClick={() =>
                                handleDownloadContract(
                                  lease.contractUrl!,
                                  lease.tenantName || "contrato"
                                )
                              }
                            >
                              Descargar
                            </Button>
                          )}
                          <Button
                            size="small"
                            variant="text"
                            color="error"
                            onClick={() => handleDelete(lease.id)}
                          >
                            Eliminar
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Box>
              {/* Desktop: Show table */}
              <Box sx={{ display: { xs: "none", md: "block" } }}>
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
                        <TableCell sx={{ fontWeight: 600 }}>
                          Acciones
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {historyLeases.map((lease) => (
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
                              {formatDate(lease.endDate) || "-"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {isLeaseTrulyActive(lease) ? (
                              <Chip
                                label="Activo"
                                color="success"
                                size="small"
                              />
                            ) : (
                              <Chip label="Finalizado" size="small" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: "flex", gap: 0.5 }}>
                              <Tooltip title="Editar">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => handleEdit(lease)}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
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
                                    <DownloadIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Eliminar">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDelete(lease.id)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Box>
            ) : null;
          })()}
        </>
      ) : roomId ? (
        // MODO PER_ROOM con roomId específico: Mostrar contrato de esa habitación
        (() => {
          const room = rooms.find((r) => r.id === roomId);
          const roomLeases = leases.filter((l) => l.roomId === roomId);
          const activeLease = roomLeases.find((l) => isLeaseTrulyActive(l));

          return (
            <>
              <Box sx={{ mb: 3 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexDirection: { xs: "column", sm: "row" },
                    gap: 2,
                    mb: 2,
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      Contrato - Habitación: {room?.name || "Desconocida"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Gestiona el contrato de arrendamiento para esta habitación
                      específica.
                    </Typography>
                  </Box>
                  <TextField
                    select
                    label="Habitación"
                    value={roomId || ""}
                    onChange={(e) => handleRoomChange(e.target.value)}
                    sx={{ minWidth: 200 }}
                    size="small"
                  >
                    {rooms.map((r) => (
                      <MenuItem key={r.id} value={r.id}>
                        {r.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
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
                            {isLeaseTrulyActive(activeLease) ? (
                              <Chip
                                label="Activo"
                                color="success"
                                size="small"
                                sx={{ ml: "auto" }}
                              />
                            ) : (
                              <Chip
                                label="Finalizado"
                                color="default"
                                size="small"
                                sx={{ ml: "auto" }}
                              />
                            )}
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
              )}

              {/* Historial de contratos - Always show if there are contracts */}
              {(() => {
                // Filter out active lease and sort by creation date (newest first)
                const historyLeases = roomLeases
                  .filter((l) => l.id !== activeLease?.id)
                  .sort((a, b) => {
                    const aDate = a.createdAt || 0;
                    const bDate = b.createdAt || 0;
                    return bDate - aDate;
                  });

                return historyLeases.length > 0 ? (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Historial de contratos ({historyLeases.length})
                    </Typography>
                    {/* Mobile-friendly: Show cards on small screens */}
                    <Box sx={{ display: { xs: "block", md: "none" } }}>
                      <Stack spacing={2}>
                        {historyLeases.map((lease) => (
                        <Card key={lease.id} variant="outlined">
                          <CardContent>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {lease.tenantName || "-"}
                              </Typography>
                              {isLeaseTrulyActive(lease) ? (
                                <Chip label="Activo" color="success" size="small" />
                              ) : (
                                <Chip label="Finalizado" size="small" />
                              )}
                            </Box>
                            <Stack spacing={0.5}>
                              <Typography variant="body2" color="text.secondary">
                                <strong>Renta:</strong> {formatCurrency(lease.monthlyRent)}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                <strong>Inicio:</strong> {formatDate(lease.startDate)}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                <strong>Fin:</strong> {formatDate(lease.endDate) || "Sin definir"}
                              </Typography>
                            </Stack>
                            <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
                              <Button size="small" variant="outlined" onClick={() => handleEdit(lease)}>
                                Editar
                              </Button>
                              {lease.contractUrl && (
                                <Button
                                  size="small"
                                  variant="text"
                                  startIcon={<DownloadIcon />}
                                  onClick={() =>
                                    handleDownloadContract(
                                      lease.contractUrl!,
                                      lease.tenantName || "contrato"
                                    )
                                  }
                                >
                                  Descargar
                                </Button>
                              )}
                            </Box>
                          </CardContent>
                        </Card>
                      ))}
                    </Stack>
                  </Box>
                  {/* Desktop: Show table */}
                  <Box sx={{ display: { xs: "none", md: "block" } }}>
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
                            <TableCell sx={{ fontWeight: 600 }}>
                              Acciones
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {historyLeases.map((lease) => (
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
                                  {formatDate(lease.endDate) || "-"}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {isLeaseTrulyActive(lease) ? (
                                  <Chip
                                    label="Activo"
                                    color="success"
                                    size="small"
                                  />
                                ) : (
                                  <Chip label="Finalizado" size="small" />
                                )}
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: "flex", gap: 0.5 }}>
                                  <Tooltip title="Editar">
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={() => handleEdit(lease)}
                                    >
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
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
                                        <DownloadIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </Box>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Box>
                ) : null;
              })()}
            </>
          );
        })()
      ) : (
        // MODO PER_ROOM sin roomId: Mostrar selector de habitación
        <>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Gestión de Contratos por Habitación
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Selecciona una habitación para gestionar su contrato de arrendamiento.
            </Typography>
            {rooms.length > 0 ? (
              <TextField
                select
                label="Selecciona una habitación"
                value=""
                onChange={(e) => handleRoomChange(e.target.value)}
                sx={{ minWidth: 300 }}
                size="medium"
                helperText="Cada habitación puede tener solo 1 contrato activo a la vez"
              >
                {rooms.map((r) => {
                  const roomLease = leases
                    .filter((l) => l.roomId === r.id)
                    .find((l) => isLeaseTrulyActive(l));
                  return (
                    <MenuItem key={r.id} value={r.id}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                        <span>{r.name}</span>
                        {roomLease && (
                          <Chip
                            label="Con contrato"
                            color="success"
                            size="small"
                            sx={{ ml: 2 }}
                          />
                        )}
                      </Box>
                    </MenuItem>
                  );
                })}
              </TextField>
            ) : (
              <Alert severity="info">
                <Typography variant="body2">
                  No hay habitaciones registradas. Ve a la pestaña "Habitaciones" para crear una.
                </Typography>
              </Alert>
            )}
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
