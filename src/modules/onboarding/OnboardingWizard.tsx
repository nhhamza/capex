import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import dayjs, { Dayjs } from "dayjs";
import { useAuth } from "@/auth/authContext";
import { getProperties, createProperty, createLease, createLoan } from "@/modules/properties/api";
import {
  Box,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";

/**
 * IMPORTANT:
 * - This wizard must NEVER create organizations or user profiles.
 * - Org/profile creation happens ONLY during SignUp via POST /api/signup/initialize.
 * - Here we only help users create their first property (if they have an org but zero properties).
 */

const steps = ["Perfil", "Primera Vivienda", "Contrato (Opcional)", "Financiación (Opcional)"];

export function OnboardingWizard() {
  const navigate = useNavigate();
  const { userDoc, loading: authLoading, needsOnboarding, logout } = useAuth();

  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const finishingRef = useRef(false);

  const [checkingProperties, setCheckingProperties] = useState(true);
  const [error, setError] = useState<string>("");

  // First property
  const [firstAddress, setFirstAddress] = useState("");
  const [firstPurchasePrice, setFirstPurchasePrice] = useState<number | "">("");
  const [firstMonthlyRent, setFirstMonthlyRent] = useState<number | "">("");

  // Lease (optional)
  const [contractTenantName, setContractTenantName] = useState("");
  const [contractStartDate, setContractStartDate] = useState<Dayjs | null>(null);

  // Loan (optional)
  const [financingLoanAmount, setFinancingLoanAmount] = useState<number | "">("");
  const [financingInterestRatePct, setFinancingInterestRatePct] = useState<number | "">("");
  const [financingTermYears, setFinancingTermYears] = useState<number | "">("");
  const [financingBank, setFinancingBank] = useState("");
  const [financingLoanType, setFinancingLoanType] = useState("fixed");

  const orgId = userDoc?.organizationId || userDoc?.orgId || null;

  useEffect(() => {
    const run = async () => {
      if (authLoading) return;

      // If backend says profile/org isn't initialized, do NOT attempt to create it here.
      if (needsOnboarding || !orgId) {
        setCheckingProperties(false);
        return;
      }

      try {
        const props = await getProperties();
        if ((props?.length ?? 0) > 0) {
          navigate("/dashboard", { replace: true });
          return;
        }
      } catch (e) {
        console.error("[Onboarding] Failed to load properties:", e);
        setError("No hemos podido cargar tus propiedades. Inténtalo de nuevo.");
      } finally {
        setCheckingProperties(false);
      }
    };

    run();
  }, [authLoading, needsOnboarding, orgId, navigate]);

  const handleNext = async () => {
    if (activeStep < steps.length - 1) {
      setActiveStep((s) => s + 1);
      return;
    }

    if (finishingRef.current) return;
    finishingRef.current = true;

    if (!orgId) {
      setError("Tu cuenta aún no está inicializada (no hay organización asociada).");
      finishingRef.current = false;
      return;
    }

    if (!firstAddress || typeof firstPurchasePrice !== "number" || firstPurchasePrice <= 0) {
      setError("Por favor, completa la dirección y el precio de compra de la vivienda.");
      finishingRef.current = false;
      return;
    }

    setSaving(true);
    setError("");

    try {
      const clientRequestId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const newProperty = await createProperty({
        organizationId: orgId,
        address: firstAddress,
        purchasePrice: firstPurchasePrice,
        purchaseDate: dayjs().toISOString(),
        notes: "Creado durante onboarding",
        clientRequestId,
      });

      const propertyId = newProperty.id;

      // Optional lease
      if (
        propertyId &&
        (contractTenantName ||
          contractStartDate ||
          (typeof firstMonthlyRent === "number" && firstMonthlyRent > 0))
      ) {
        try {
          await createLease({
            propertyId,
            tenantName: contractTenantName || "Inquilino",
            startDate: contractStartDate ? contractStartDate.toISOString() : dayjs().toISOString(),
            monthlyRent: typeof firstMonthlyRent === "number" ? firstMonthlyRent : 0,
          });
        } catch (leaseErr) {
          console.warn("[Onboarding] Lease creation failed:", leaseErr);
        }
      }

      // Optional loan
      if (propertyId && typeof financingLoanAmount === "number" && financingLoanAmount > 0) {
        const annualRatePct = typeof financingInterestRatePct === "number" ? financingInterestRatePct : 0;
        const termMonths =
          typeof financingTermYears === "number" ? Math.max(0, Math.round(financingTermYears * 12)) : 0;

        try {
          await createLoan({
            propertyId,
            principal: financingLoanAmount,
            annualRatePct,
            termMonths,
            startDate: dayjs().toISOString(),
            interestOnlyMonths: 0,
            upFrontFees: 0,
            notes: financingBank ? `Banco: ${financingBank}, Tipo: ${financingLoanType}` : `Tipo: ${financingLoanType}`,
          });
        } catch (loanErr) {
          console.warn("[Onboarding] Loan creation failed:", loanErr);
        }
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("[Onboarding] Finish failed:", err);
      setError("Error al crear tu primera vivienda. Por favor, intenta de nuevo.");
    } finally {
      setSaving(false);
      finishingRef.current = false;
    }
  };

  const handleBack = () => setActiveStep((s) => Math.max(0, s - 1));
  const handleSkip = () => navigate("/dashboard", { replace: true });

  if (authLoading || checkingProperties) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (needsOnboarding || !orgId) {
    return (
      <Box sx={{ maxWidth: 720, mx: "auto", px: 2, py: 6 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Completa tu registro
          </Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Tu cuenta todavía no tiene una organización asociada. Por seguridad, no creamos una nueva automáticamente.
          </Alert>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Por favor, cierra sesión y crea tu cuenta desde la pantalla de registro (Sign Up).
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={logout}>
              Cerrar sesión
            </Button>
            <Button variant="outlined" onClick={() => navigate("/signup")}>
              Ir a registro
            </Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", px: 2, py: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Configuración inicial
        </Typography>
        <Typography variant="body2" sx={{ mb: 3, color: "text.secondary" }}>
          Te ayudamos a crear tu primera vivienda para empezar a usar la app.
        </Typography>

        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 ? (
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Perfil
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              (Opcional) Puedes saltarte este paso. Lo importante es crear tu primera vivienda.
            </Typography>
          </Box>
        ) : null}

        {activeStep === 1 ? (
          <Stack spacing={2}>
            <TextField label="Dirección" value={firstAddress} onChange={(e) => setFirstAddress(e.target.value)} fullWidth />
            <TextField
              label="Precio de compra (€)"
              value={firstPurchasePrice}
              onChange={(e) => setFirstPurchasePrice(e.target.value === "" ? "" : Number(e.target.value))}
              type="number"
              fullWidth
            />
            <TextField
              label="Alquiler mensual (€) (opcional)"
              value={firstMonthlyRent}
              onChange={(e) => setFirstMonthlyRent(e.target.value === "" ? "" : Number(e.target.value))}
              type="number"
              fullWidth
            />
          </Stack>
        ) : null}

        {activeStep === 2 ? (
          <Stack spacing={2}>
            <TextField
              label="Nombre inquilino (opcional)"
              value={contractTenantName}
              onChange={(e) => setContractTenantName(e.target.value)}
              fullWidth
            />
            <DatePicker
              label="Fecha de inicio del contrato (opcional)"
              value={contractStartDate}
              onChange={(newValue) => setContractStartDate(newValue)}
              slotProps={{
                textField: {
                  fullWidth: true,
                },
              }}
            />
          </Stack>
        ) : null}

        {activeStep === 3 ? (
          <Stack spacing={2}>
            <TextField
              label="Importe préstamo (opcional)"
              value={financingLoanAmount}
              onChange={(e) => setFinancingLoanAmount(e.target.value === "" ? "" : Number(e.target.value))}
              type="number"
              fullWidth
            />
            <TextField
              label="Interés anual (%) (opcional)"
              value={financingInterestRatePct}
              onChange={(e) => setFinancingInterestRatePct(e.target.value === "" ? "" : Number(e.target.value))}
              type="number"
              fullWidth
            />
            <TextField
              label="Plazo (años) (opcional)"
              value={financingTermYears}
              onChange={(e) => setFinancingTermYears(e.target.value === "" ? "" : Number(e.target.value))}
              type="number"
              fullWidth
            />
            <TextField label="Banco (opcional)" value={financingBank} onChange={(e) => setFinancingBank(e.target.value)} fullWidth />
            <FormControl fullWidth>
              <InputLabel id="loan-type-label">Tipo</InputLabel>
              <Select labelId="loan-type-label" value={financingLoanType} label="Tipo" onChange={(e) => setFinancingLoanType(String(e.target.value))}>
                <MenuItem value="fixed">Fijo</MenuItem>
                <MenuItem value="variable">Variable</MenuItem>
                <MenuItem value="mixed">Mixto</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        ) : null}

        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button disabled={activeStep === 0 || saving} onClick={handleBack}>
            Atrás
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="text" disabled={saving} onClick={handleSkip}>
            Saltar
          </Button>
          <Button variant="contained" disabled={saving} onClick={handleNext}>
            {activeStep === steps.length - 1 ? "Finalizar" : "Siguiente"}
          </Button>
        </Stack>

        {saving ? (
          <Box sx={{ mt: 2 }}>
            <Alert severity="info">Guardando…</Alert>
          </Box>
        ) : null}
      </Paper>
    </Box>
  );
}
