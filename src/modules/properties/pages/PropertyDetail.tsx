import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Button,
  Snackbar,
  Alert,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  getProperty,
  getLease,
  getLoan,
  getRecurringExpenses,
  getOneOffExpenses,
} from "../api";
import {
  Property,
  Lease,
  Loan,
  RecurringExpense,
  OneOffExpense,
} from "../types";
import { PropertySummaryTab } from "./PropertySummaryTab";
import { PropertyPurchaseTab } from "./PropertyPurchaseTab";
import { PropertyLeaseTab } from "./PropertyLeaseTab";
import { PropertyRecurringTab } from "./PropertyRecurringTab";
import { PropertyCapexTab } from "./PropertyCapexTab";
import { PropertyDocsTab } from "./PropertyDocsTab";
import { PropertyLoanTab } from "./PropertyLoanTab";
import { PropertyNotesTab } from "./PropertyNotesTab";
import { ResponsivePropertyTabs } from "../components/ResponsivePropertyTabs";

export function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState<Property | null>(null);
  const [lease, setLease] = useState<Lease | null>(null);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [capex, setCapex] = useState<OneOffExpense[]>([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });

  const currentTab = searchParams.get("tab") || "resumen";

  const loadData = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const [prop, ls, ln, rec, cap] = await Promise.all([
        getProperty(id),
        getLease(id),
        getLoan(id),
        getRecurringExpenses(id),
        getOneOffExpenses(id),
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
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Error al cargar datos",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleTabChange = (_: any, newValue: string) => {
    setSearchParams({ tab: newValue });
  };

  const handleDataChanged = () => {
    loadData();
    setSnackbar({
      open: true,
      message: "Datos actualizados",
      severity: "success",
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!property) {
    return null;
  }

  return (
    <Box sx={{ maxWidth: "100%", overflow: "hidden" }}>
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
      </Box>

      <Paper sx={{ overflow: "hidden" }}>
        <ResponsivePropertyTabs
          value={currentTab}
          onChange={(v) => handleTabChange(null, v)}
        />
        <Box
          sx={{
            p: { xs: 2, sm: 3 },
            maxWidth: "100%",
            overflow: "auto",
            wordBreak: "break-word",
          }}
        >
          {currentTab === "resumen" && (
            <PropertySummaryTab
              property={property}
              lease={lease}
              loan={loan}
              recurring={recurring}
            />
          )}
          {currentTab === "compra" && (
            <PropertyPurchaseTab
              property={property}
              onSave={handleDataChanged}
            />
          )}
          {currentTab === "contrato" && (
            <PropertyLeaseTab
              propertyId={property.id}
              lease={lease}
              onSave={handleDataChanged}
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
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
