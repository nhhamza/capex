import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Button,
  Snackbar,
  Alert,
  Skeleton,
  LinearProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  TextField,
  DialogActions,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import {
  getProperty,
  getLease,
  getLoan,
  getRecurringExpenses,
  getOneOffExpenses,
  getLeases,
  getRooms,
  updateProperty,
} from "../api";
import {
  Property,
  Lease,
  Loan,
  RecurringExpense,
  OneOffExpense,
  Room,
} from "../types";
import { PropertyQuickView } from "./PropertyQuickView";
import { PropertyIncomesTab } from "./PropertyIncomesTab";
import { PropertyExpensesAndLoanTab } from "./PropertyExpensesAndLoanTab";
import { PropertyDataTab } from "./PropertyDataTab";
import { PropertySummaryTab } from "./PropertySummaryTab";
import { PropertyLeaseTab } from "./PropertyLeaseTab";
import { PropertyLoanTab } from "./PropertyLoanTab";
import { PropertyRoomsTab } from "./PropertyRoomsTab";
import { ResponsivePropertyTabs } from "../components/ResponsivePropertyTabs";

export function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [property, setProperty] = useState<Property | null>(null);
  const [lease, setLease] = useState<Lease | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [capex, setCapex] = useState<OneOffExpense[]>([]);

  // 👇 NUEVOS ESTADOS
  const [leases, setLeases] = useState<Lease[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });
  const [editNameDialogOpen, setEditNameDialogOpen] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const currentTab = searchParams.get("tab") || "quick";
  const roomIdFromUrl = searchParams.get("roomId") ?? null;

  const loadData = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const [prop, ls, ln, rec, cap, allLeases, allRooms] = await Promise.all([
        getProperty(id),
        getLease(id),
        getLoan(id),
        getRecurringExpenses(id),
        getOneOffExpenses(id),
        getLeases(id), // 👈 lista completa de leases
        getRooms(id), // 👈 lista de habitaciones
      ]);

      if (!prop) {
        setSnackbar({
          open: true,
          message: "Vivienda no encontrada",
          severity: "error",
        });
        navigate("/properties");
        return;
      }

      setProperty(prop);
      setLease(ls || null);
      setLoan(ln || null);
      setRecurring(rec);
      setCapex(cap);
      setLeases(allLeases || []);
      setRooms(allRooms || []);
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Error al cargar datos",
        severity: "error",
      });
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTabChange = (_: unknown, newValue: string) => {
    // Mantener otros posibles parámetros de búsqueda si algún día los añades
    const next = new URLSearchParams(searchParams);
    next.set("tab", newValue);
    setSearchParams(next);
  };

  const handleDataChanged = () => {
    // Recargar datos pero sin perder la pantalla actual
    loadData();
    setSnackbar({
      open: true,
      message: "Datos actualizados",
      severity: "success",
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleOpenEditName = () => {
    setEditNameValue(property?.address || "");
    setEditNameDialogOpen(true);
  };

  const handleCloseEditName = () => {
    setEditNameDialogOpen(false);
  };

  const handleSaveName = async () => {
    if (!property || !editNameValue.trim()) return;
    setRenaming(true);
    try {
      const newAddress = editNameValue.trim();
      await updateProperty(property.id, { address: newAddress });
      setProperty({ ...property, address: newAddress });
      setSnackbar({
        open: true,
        message: "Nombre de vivienda actualizado",
        severity: "success",
      });
      setEditNameDialogOpen(false);
    } catch (error) {
      console.error("Error renombrando vivienda:", error);
      setSnackbar({
        open: true,
        message: "No se pudo actualizar el nombre. Intenta de nuevo.",
        severity: "error",
      });
    } finally {
      setRenaming(false);
    }
  };

  // 🔵 Primera carga: skeleton más profesional en lugar de solo un spinner
  if (initialLoading) {
    return (
      <Box sx={{ maxWidth: "100%" }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "flex-start", sm: "center" },
            mb: 3,
            gap: 2,
          }}
        >
          <Skeleton variant="rectangular" width={120} height={40} />
          <Skeleton variant="text" width="60%" height={40} />
        </Box>

        <Paper sx={{ p: { xs: 2, sm: 3 } }}>
          <Skeleton
            variant="rectangular"
            width="100%"
            height={40}
            sx={{ mb: 2 }}
          />
          <Skeleton variant="rectangular" width="100%" height={200} />
        </Paper>
      </Box>
    );
  }

  // Si después de cargar no hay propiedad, mostramos un estado vacío amable
  if (!property) {
    return (
      <Box sx={{ textAlign: "center", mt: 6 }}>
        <Typography variant="h5" gutterBottom>
          No se ha podido cargar la vivienda
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Puede que se haya eliminado o que no tengas permisos para verla.
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate("/properties")}
          startIcon={<ArrowBackIcon />}
        >
          Volver al listado
        </Button>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
        >
          <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
        </Snackbar>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: "100%", overflow: "hidden" }}>
      {/* Cuando se están recargando datos, mostramos una barra sutil arriba */}
      {loading && (
        <Box sx={{ mb: 1 }}>
          <LinearProgress />
        </Box>
      )}

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "flex-start", sm: "center" },
          mb: 3,
          gap: 2,
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/properties")}
          sx={{ minHeight: 48 }}
        >
          Volver
        </Button>
        <Box
          sx={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            <Typography
              variant="h4"
              sx={{
                fontSize: { xs: "1.5rem", sm: "2rem" },
                wordBreak: "break-word",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {property.address}
            </Typography>
            <IconButton
              size="small"
              onClick={handleOpenEditName}
              aria-label="Editar nombre de la vivienda"
            >
              <EditIcon />
            </IconButton>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Vista detallada de la vivienda: resumen, compra, contrato, gastos,
            financiación y notas.
          </Typography>
        </Box>
      </Box>

      <Paper sx={{ overflow: "hidden" }}>
        <ResponsivePropertyTabs
          value={currentTab}
          onChange={(v) => handleTabChange(null, v)}
          rentalMode={property.rentalMode}
        />

        <Box
          sx={{
            p: { xs: 2, sm: 3 },
            maxWidth: "100%",
            overflow: "auto",
            wordBreak: "break-word",
            position: "relative",
          }}
        >
          {/* Mientras recargamos, dejamos el contenido visible (últimos datos)
              y si quieres podrías poner un overlay suave con un spinner pequeño */}
          {loading && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                bgcolor: "rgba(255,255,255,0.4)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                pointerEvents: "none",
              }}
            >
              <CircularProgress size={32} />
            </Box>
          )}

          {currentTab === "quick" && (
            <PropertyQuickView
              property={property}
              lease={lease}
              loan={loan}
              recurring={recurring}
              leases={leases}
              rooms={rooms}
              onTabChange={(tab) => handleTabChange(null, tab)}
              onExportReport={() => {
                // Handle export - can be implemented later
                console.log("Export report clicked");
              }}
            />
          )}
          {currentTab === "ingresos" && (
            <PropertyIncomesTab
              property={property}
              lease={lease}
              leases={leases}
              rooms={rooms}
              onSave={handleDataChanged}
            />
          )}
          {currentTab === "gastos" && (
            <PropertyExpensesAndLoanTab
              propertyId={property.id}
              loan={loan}
              recurring={recurring}
              capex={capex}
              onSave={handleDataChanged}
            />
          )}
          {currentTab === "datos" && (
            <PropertyDataTab property={property} onSave={handleDataChanged} />
          )}
          {currentTab === "resumen" && (
            <PropertySummaryTab
              property={property}
              lease={lease}
              loan={loan}
              recurring={recurring}
              leases={leases}
              rooms={rooms}
              onSave={handleDataChanged}
            />
          )}
          {currentTab === "hipoteca" && (
            <PropertyLoanTab
              propertyId={property.id}
              loan={loan}
              lease={lease}
              onSave={handleDataChanged}
            />
          )}
          {/* Keep old tabs for backward compatibility */}
          {currentTab === "habitaciones" &&
            property.rentalMode === "PER_ROOM" && (
              <PropertyRoomsTab
                propertyId={property.id}
                onDataChanged={handleDataChanged}
              />
            )}
          {currentTab === "contrato" && (
            <PropertyLeaseTab
              property={property}
              lease={lease}
              onSave={handleDataChanged}
              roomId={roomIdFromUrl}
            />
          )}
        </Box>
      </Paper>

      <Dialog
        open={editNameDialogOpen}
        onClose={handleCloseEditName}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Editar nombre de la vivienda</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Actualiza el nombre o la dirección de la vivienda. Este valor se
            mostrará en la cabecera y en las listas.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            fullWidth
            label="Nombre / Dirección"
            value={editNameValue}
            onChange={(event) => setEditNameValue(event.target.value)}
            disabled={renaming}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditName} disabled={renaming}>
            Cancelar
          </Button>
          <Button
            onClick={handleSaveName}
            disabled={renaming || !editNameValue.trim()}
            variant="contained"
          >
            {renaming ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
