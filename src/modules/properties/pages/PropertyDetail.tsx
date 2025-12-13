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
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  getProperty,
  getLease,
  getLoan,
  getRecurringExpenses,
  getOneOffExpenses,
  getLeases, // 👈 NUEVO
  getRooms, // 👈 NUEVO
} from "../api";
import {
  Property,
  Lease,
  Loan,
  RecurringExpense,
  OneOffExpense,
  Room, // 👈 NUEVO
} from "../types";
import { PropertySummaryTab } from "./PropertySummaryTab";
import { PropertyPurchaseTab } from "./PropertyPurchaseTab";
import { PropertyLeaseTab } from "./PropertyLeaseTab";
import { PropertyRecurringTab } from "./PropertyRecurringTab";
import { PropertyCapexTab } from "./PropertyCapexTab";
import { PropertyDocsTab } from "./PropertyDocsTab";
import { PropertyLoanTab } from "./PropertyLoanTab";
import { PropertyNotesTab } from "./PropertyNotesTab";
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

  const currentTab = searchParams.get("tab") || "resumen";
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
        <Box sx={{ minWidth: 0 }}>
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
          {/* Subtítulo suave para contexto (puedes cambiar por city/ref si la tienes en el modelo) */}
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

          {currentTab === "resumen" && (
            <PropertySummaryTab
              property={property}
              lease={lease}
              loan={loan}
              recurring={recurring}
              leases={leases} // 👈 NUEVO
              rooms={rooms} // 👈 NUEVO
            />
          )}
          {currentTab === "compra" && (
            <PropertyPurchaseTab
              property={property}
              onSave={handleDataChanged}
            />
          )}
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
          {currentTab === "gastos-fijos" && (
            <PropertyRecurringTab
              propertyId={property.id}
              expenses={recurring}
              onSave={handleDataChanged}
            />
          )}
          {currentTab === "capex" && (
            <PropertyCapexTab
              propertyId={property.id}
              expenses={capex}
              onSave={handleDataChanged}
            />
          )}
          {currentTab === "docs" && (
            <PropertyDocsTab propertyId={property.id} />
          )}
          {currentTab === "financiacion" && (
            <PropertyLoanTab
              propertyId={property.id}
              loan={loan}
              lease={lease}
              onSave={handleDataChanged}
            />
          )}
          {currentTab === "notas" && (
            <PropertyNotesTab property={property} onSave={handleDataChanged} />
          )}
        </Box>
      </Paper>

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
