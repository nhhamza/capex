import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  TextField,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  Checkbox,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  CardActions,
  Divider,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import { Room, Lease } from "../types";
import { isLeaseActiveToday, getActiveRoomLease } from "@/utils/date";
import {
  getRooms,
  createRoom,
  updateRoom,
  deleteRoom,
  getLeases,
} from "../api";

const schema = z.object({
  name: z.string().min(1, "Nombre de la habitación requerido"),
  sizeM2: z.number().optional(),
  floor: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

type FormData = z.infer<typeof schema>;

interface PropertyRoomsTabProps {
  propertyId: string;
  onDataChanged?: () => void;
}

const formatEur = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
};

// ✅ Update this if your Lease uses another field name
const getMonthlyRentFromLease = (
  lease: Lease | null | undefined
): number | null => {
  if (!lease) return null;

  // Common possibilities (safe): change/remove once you know the real one
  const maybe = lease as unknown as Record<string, unknown>;
  const candidates = ["monthlyRent", "rent", "amount", "price", "monthlyPrice"];

  for (const key of candidates) {
    const v = maybe[key];
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "") {
      const parsed = Number(v);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }

  return null;
};

export function PropertyRoomsTab({
  propertyId,
  onDataChanged,
}: PropertyRoomsTabProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      sizeM2: undefined,
      floor: "",
      notes: "",
      isActive: true,
    },
  });

  const loadData = async () => {
    setIsLoadingRooms(true);
    try {
      const [roomsData, leasesData] = await Promise.all([
        getRooms(propertyId),
        getLeases(propertyId),
      ]);
      setRooms(roomsData);
      setLeases(leasesData);
      setError("");
    } catch (err: any) {
      setError(err.message || "Error al cargar datos");
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const isRoomOccupied = (roomId: string): boolean => {
    return leases.some(
      (l) => l.roomId === roomId && isLeaseActiveToday(l.startDate, l.endDate)
    );
  };

  const getRoomTenant = (roomId: string): string | null => {
    const lease = leases.find(
      (l) => l.roomId === roomId && isLeaseActiveToday(l.startDate, l.endDate)
    );
    return lease?.tenantName || null;
  };

  const getRoomRentLabel = (roomId: string): string => {
    const activeLease = getActiveRoomLease(leases, roomId);
    const rent = getMonthlyRentFromLease(activeLease);
    return rent === null ? "-" : `${formatEur(rent)}/mes`;
  };

  const handleCreateClick = () => {
    setEditingRoom(null);
    reset();
    setDialogOpen(true);
  };

  const handleEditClick = (room: Room) => {
    setEditingRoom(room);
    reset({
      name: room.name,
      sizeM2: room.sizeM2,
      floor: room.floor,
      notes: room.notes,
      isActive: room.isActive,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      if (editingRoom) {
        await updateRoom(editingRoom.id, data);
      } else {
        await createRoom({ ...data, propertyId });
      }
      setDialogOpen(false);
      await loadData();
      onDataChanged?.();
    } catch (err: any) {
      setError(err.message || "Error al guardar habitación");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContractClick = (room: Room) => {
    const activeLease = getActiveRoomLease(leases, room.id);
    if (activeLease) {
      alert(
        "Esta habitación ya tiene un contrato activo. Finaliza el contrato actual antes de crear uno nuevo."
      );
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("tab", "contrato");
    next.set("roomId", room.id);
    navigate(`/properties/${propertyId}?${next.toString()}`);
  };

  const handleViewContractClick = (room: Room) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "contrato");
    next.set("roomId", room.id);
    navigate(`/properties/${propertyId}?${next.toString()}`);
  };

  const handleDeleteClick = async (roomId: string) => {
    try {
      setLoading(true);
      await deleteRoom(roomId);
      await loadData();
      onDataChanged?.();
    } catch (err: any) {
      setError(err.message || "Error al eliminar habitación");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRoom(null);
    reset();
  };

  if (isLoadingRooms && rooms.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          alignItems: isMobile ? "stretch" : "center",
          mb: 3,
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h6" gutterBottom>
            Gestión de Habitaciones
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Crea y gestiona las habitaciones de la propiedad. Los contratos se
            asocian a habitaciones específicas en modo por habitaciones.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateClick}
          disabled={loading}
          fullWidth={isMobile}
        >
          Nueva Habitación
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {isLoadingRooms && rooms.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Actualizando habitaciones...
        </Alert>
      )}

      {rooms.length === 0 ? (
        <Alert severity="info">
          <Typography variant="body2" gutterBottom>
            No hay habitaciones registradas. Crea la primera presionando el
            botón "Nueva Habitación".
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Solo puede haber 1 contrato activo por habitación. Para crear uno
            nuevo en una habitación, primero finaliza el actual.
          </Typography>
        </Alert>
      ) : isMobile ? (
        <Stack spacing={2} sx={{ mt: 2 }}>
          {rooms.map((room) => {
            const occupied = isRoomOccupied(room.id);
            const tenant = getRoomTenant(room.id);
            const rentLabel = getRoomRentLabel(room.id);

            return (
              <Card
                key={room.id}
                variant="outlined"
                sx={{ opacity: room.isActive ? 1 : 0.6 }}
              >
                <CardContent sx={{ pb: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <MeetingRoomIcon fontSize="small" color="primary" />
                    <Typography variant="subtitle1" sx={{ flex: 1 }} noWrap>
                      {room.name}
                    </Typography>
                    {!room.isActive && (
                      <Chip label="Inactiva" size="small" variant="outlined" />
                    )}
                  </Stack>

                  <Stack
                    direction="row"
                    spacing={1}
                    flexWrap="wrap"
                    useFlexGap
                    sx={{ mt: 1 }}
                  >
                    <Chip
                      size="small"
                      color={occupied ? "success" : "warning"}
                      variant={occupied ? "filled" : "outlined"}
                      label={
                        occupied
                          ? `Ocupada${tenant ? ` · ${tenant}` : ""}`
                          : "Disponible"
                      }
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`Renta: ${rentLabel}`}
                    />
                    {room.sizeM2 ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`${room.sizeM2} m²`}
                      />
                    ) : null}
                    {room.floor ? (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`Piso: ${room.floor}`}
                      />
                    ) : null}
                  </Stack>

                  {room.notes ? (
                    <>
                      <Divider sx={{ my: 1.5 }} />
                      <Typography variant="body2" color="text.secondary">
                        {room.notes}
                      </Typography>
                    </>
                  ) : null}
                </CardContent>

                <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ width: "100%" }}
                    alignItems="center"
                  >
                    {occupied ? (
                      <Button
                        fullWidth
                        size="small"
                        variant="outlined"
                        onClick={() => handleViewContractClick(room)}
                        disabled={loading}
                        startIcon={<EditIcon fontSize="small" />}
                      >
                        Ver/Editar
                      </Button>
                    ) : (
                      <Button
                        fullWidth
                        size="small"
                        variant="contained"
                        onClick={() => handleCreateContractClick(room)}
                        disabled={loading}
                        startIcon={<AddIcon fontSize="small" />}
                      >
                        Crear contrato
                      </Button>
                    )}

                    <IconButton
                      size="small"
                      onClick={() => handleEditClick(room)}
                      disabled={loading}
                      title="Editar habitación"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>

                    <IconButton
                      size="small"
                      onClick={() => handleDeleteClick(room.id)}
                      disabled={loading || occupied}
                      title={
                        occupied
                          ? "No se puede eliminar una habitación ocupada"
                          : "Eliminar habitación"
                      }
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </CardActions>
              </Card>
            );
          })}
        </Stack>
      ) : (
        <TableContainer component={Paper} sx={{ mt: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                <TableCell sx={{ fontWeight: 600 }}>Nombre</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Tamaño (m²)</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Piso</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Estado</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">
                  Acciones
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rooms.map((room) => {
                const occupied = isRoomOccupied(room.id);
                const tenant = getRoomTenant(room.id);

                return (
                  <TableRow
                    key={room.id}
                    sx={{
                      opacity: room.isActive ? 1 : 0.6,
                      "&:hover": { backgroundColor: "#fafafa" },
                    }}
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <MeetingRoomIcon fontSize="small" color="primary" />
                        <Typography variant="body2">{room.name}</Typography>
                        {!room.isActive && (
                          <Chip
                            label="Inactiva"
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {room.sizeM2 ? `${room.sizeM2} m²` : "-"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {room.floor || "-"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {occupied ? (
                        <Chip
                          label={`Ocupada por ${tenant}`}
                          size="small"
                          color="success"
                          variant="filled"
                        />
                      ) : (
                        <Chip
                          label="Disponible"
                          size="small"
                          color="warning"
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={0.5}
                        justifyContent="flex-end"
                      >
                        {occupied ? (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleViewContractClick(room)}
                            disabled={loading}
                            startIcon={<EditIcon fontSize="small" />}
                          >
                            Ver/Editar contrato
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => handleCreateContractClick(room)}
                            disabled={loading}
                            startIcon={<AddIcon fontSize="small" />}
                          >
                            Crear contrato
                          </Button>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => handleEditClick(room)}
                          disabled={loading}
                          title="Editar habitación"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteClick(room.id)}
                          disabled={loading || occupied}
                          title={
                            occupied
                              ? "No se puede eliminar una habitación ocupada"
                              : "Eliminar habitación"
                          }
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dialog para crear/editar */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingRoom ? "Editar Habitación" : "Nueva Habitación"}
        </DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}
        >
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Nombre de la Habitación"
                fullWidth
                placeholder="ej: Habitación Principal, Suite"
                error={!!errors.name}
                helperText={errors.name?.message}
              />
            )}
          />

          <Controller
            name="sizeM2"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Tamaño (m²)"
                type="number"
                fullWidth
                placeholder="ej: 25"
                error={!!errors.sizeM2}
                helperText={errors.sizeM2?.message}
                onChange={(e) =>
                  field.onChange(
                    e.target.value ? parseFloat(e.target.value) : undefined
                  )
                }
              />
            )}
          />

          <Controller
            name="floor"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Piso"
                fullWidth
                placeholder="ej: Planta Baja, 1º, 2º"
                error={!!errors.floor}
                helperText={errors.floor?.message}
              />
            )}
          />

          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Notas"
                fullWidth
                multiline
                rows={3}
                placeholder="Características especiales, detalles, etc."
                error={!!errors.notes}
                helperText={errors.notes?.message}
              />
            )}
          />

          <Controller
            name="isActive"
            control={control}
            render={({ field }) => (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Checkbox
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
                <Typography variant="body2">Habitación activa</Typography>
              </Box>
            )}
          />
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            {editingRoom ? "Guardar Cambios" : "Crear Habitación"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
