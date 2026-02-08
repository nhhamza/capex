import { useState } from "react";
import {
  Box,
  Typography,
  Alert,
  Card,
  CardContent,
  Chip,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { Property, Lease, Room } from "../types";
import { createRoom } from "../api";
import { PropertyLeaseTab } from "./PropertyLeaseTab";

interface PropertyIncomesTabProps {
  property: Property;
  lease: Lease | null;
  leases: Lease[];
  rooms: Room[];
  onSave: () => void;
}

/**
 * Consolidated tab for managing all income sources (contracts + rooms)
 * Shows single property lease for WHOLE_UNIT or room-by-room breakdown for PER_ROOM
 */
export function PropertyIncomesTab({
  property,
  lease,
  leases,
  rooms,
  onSave,
}: PropertyIncomesTabProps) {
  const [openAddRoom, setOpenAddRoom] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomSize, setRoomSize] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);

  const getRoomLease = (roomId: string, roomLeases: Lease[]) => {
    return roomLeases.find((l) => l.roomId === roomId);
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      return;
    }

    setCreatingRoom(true);
    try {
      await createRoom({
        propertyId: property.id,
        name: roomName.trim(),
        sizeM2: roomSize ? parseInt(roomSize, 10) : undefined,
        isActive: true,
      });

      setRoomName("");
      setRoomSize("");
      setOpenAddRoom(false);
      onSave(); // Reload data
    } catch (err) {
      console.error("Error creating room:", err);
    } finally {
      setCreatingRoom(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={900} gutterBottom>
        Gestión de ingresos
      </Typography>

      {property.rentalMode === "ENTIRE_UNIT" ? (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Gestiona el contrato de alquiler para toda la propiedad
          </Typography>
          {/* Use existing PropertyLeaseTab for single property */}
          <PropertyLeaseTab property={property} lease={lease} onSave={onSave} />
        </>
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 3 }}>
            Esta propiedad se alquila por habitaciones. Gestiona cada habitación
            y su contrato por separado.
          </Alert>

          <Stack spacing={2}>
            {rooms.length === 0 ? (
              <Box>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  No hay habitaciones registradas. Añade la primera habitación
                  para empezar.
                </Alert>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setOpenAddRoom(true)}
                  color="primary"
                >
                  Añadir Habitación
                </Button>
              </Box>
            ) : (
              <>
                {rooms.map((room) => {
                  const roomLease = getRoomLease(room.id, leases);
                  return (
                    <Card key={room.id}>
                      <CardContent>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Box>
                            <Typography variant="h6" fontWeight={700}>
                              {room.name}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{ color: "text.secondary" }}
                            >
                              {room.sizeM2 && `${room.sizeM2}m²`}
                            </Typography>
                          </Box>

                          {roomLease ? (
                            <Chip
                              label={`€${roomLease.monthlyRent}/mes`}
                              color="success"
                              variant="filled"
                            />
                          ) : (
                            <Chip
                              label="Sin contrato"
                              color="warning"
                              variant="outlined"
                            />
                          )}
                        </Stack>

                        <Button
                          size="small"
                          sx={{ mt: 2 }}
                          onClick={() => {
                            // This would navigate to lease management for this room
                            window.location.href = `/properties/${property.id}?tab=contrato&roomId=${room.id}`;
                          }}
                        >
                          {roomLease ? "Editar" : "Crear"} contrato
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setOpenAddRoom(true)}
                  sx={{ mt: 2 }}
                  fullWidth
                >
                  Añadir Otra Habitación
                </Button>
              </>
            )}
          </Stack>
        </>
      )}

      {/* Dialog para crear nueva habitación */}
      <Dialog
        open={openAddRoom}
        onClose={() => !creatingRoom && setOpenAddRoom(false)}
      >
        <DialogTitle>Añadir Nueva Habitación</DialogTitle>
        <DialogContent sx={{ minWidth: 400, pt: 2 }}>
          <TextField
            fullWidth
            label="Nombre de la habitación"
            placeholder="Ej: Habitación 1, Dormitorio Principal"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            disabled={creatingRoom}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Tamaño (m²)"
            type="number"
            placeholder="Ej: 20"
            value={roomSize}
            onChange={(e) => setRoomSize(e.target.value)}
            disabled={creatingRoom}
            inputProps={{ min: 0, step: 0.1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddRoom(false)} disabled={creatingRoom}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreateRoom}
            variant="contained"
            disabled={!roomName.trim() || creatingRoom}
          >
            {creatingRoom ? <CircularProgress size={24} /> : "Crear"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
