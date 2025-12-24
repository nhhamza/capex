import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
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

/**
 * IMPORTANT:
 * - This wizard must NEVER create organizations or user profiles.
 * - Org/profile creation happens ONLY during SignUp via POST /api/bootstrap { createOrg: true }.
 * - Here we only help users create their first property (if they have an org but zero properties).
 */

const steps = [
  "Perfil",
  "Primera Vivienda",
  "Contrato (Opcional)",
  "Financiación (Opcional)",
];

export function OnboardingWizard() {
  const navigate = useNavigate();
  const { userDoc, loading: authLoading, needsOnboarding, logout } = useAuth();

  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const finishingRef = useRef(false);

  const [checkingProperties, setCheckingProperties] = useState(true);
  const [error, setError] = useState<string>("");

  // Local temp state for first property fields
  const [firstAddress, setFirstAddress] = useState("");
  const [firstPurchasePrice, setFirstPurchasePrice] = useState<number | "">("");
  const [firstMonthlyRent, setFirstMonthlyRent] = useState<number | "">("");

  // Contract information state
  const [contractTenantName, setContractTenantName] = useState("");
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");

  // Financing information state
  const [financingLoanAmount, setFinancingLoanAmount] = useState<number | "">("");
  const [financingInterestRate, setFinancingInterestRate] = useState<number | "">("");
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

    // Finish
    if (finishingRef.current) return;
    finishingRef.current = true;

    // Guard: this wizard should only run for users with org initialized
    if (!orgId) {
      setError(
        "Tu cuenta aún no está inicializada (no hay organización asociada). Cierra sesión y vuelve a crear tu cuenta, o contacta soporte."
      );
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
      // Idempotency key to prevent double creation (double click / retries)
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

      const createdPropertyId = newProperty.id;

      // Optional lease
      if (
        createdPropertyId &&
        (contractTenantName ||
          contractStartDate ||
          (typeof firstMonthlyRent === "number" && firstMonthlyRent > 0))
      ) {
        try {
          await createLease({
            propertyId: createdPropertyId,
            tenantName: contractTenantName || "Inquilino",
            startDate: contractStartDate || dayjs().toISOString(),
            endDate: contractEndDate || undefined,
            monthlyRent:
              typeof firstMonthlyRent === "number" && firstMonthlyRent > 0
                ? firstMonthlyRent
                : 0,
          });
        } catch (leaseErr) {
          console.warn("[Onboarding] Lease creation failed:", leaseErr);
          // Non-blocking
        }
      }

      // Optional loan
      if (
        createdPropertyId &&
        typeof financingLoanAmount === "number" &&
        financingLoanAmount > 0
      ) {
        try {
          await createLoan({
            propertyId: createdPropertyId,
            principal: financingLoanAmount,
            interestRate:
              typeof financingInterestRate === "number" ? financingInterestRate : 0,
            termYears: typeof financingTermYears === "number" ? financingTermYears : 0,
            bank: financingBank || undefined,
            loanType: financingLoanType as any,
            startDate: dayjs().toISOString(),
          });
        } catch (loanErr) {
          console.warn("[Onboarding] Loan creation failed:", loanErr);
          // Non-blocking
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

  const handleBack = () => {
    setActiveStep((s) => Math.max(0, s - 1));
  };

  const handleSkip = () => {
    // Skip wizard
    navigate("/dashboard", { replace: true });
  };

  if (authLoading || checkingProperties) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // If profile/org isn't initialized, show a safe message (no auto-creation here).
  if (needsOnboarding || !orgId) {
    return (
      <Box sx={{ maxWidth: 720, mx: "auto", px: 2, py: 6 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Completa tu registro
          </Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Tu cuenta todavía no tiene una organización asociada. Por seguridad, no
            podemos crear una nueva automáticamente en login.
          </Alert>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Solución recomendada: cierra sesión y crea tu cuenta desde la pantalla
            de registro (Sign Up). Si esto te ocurre tras haber usado la app, puede
            ser un problema de inicialización del perfil y necesitamos revisarlo.
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
              (Opcional) Puedes saltarte este paso. Lo importante es crear tu primera
              vivienda.
            </Typography>
          </Box>
        ) : null}

        {activeStep === 1 ? (
          <Stack spacing={2}>
            <TextField
              label="Dirección"
              value={firstAddress}
              onChange={(e) => setFirstAddress(e.target.value)}
              fullWidth
            />
            <TextField
              label="Precio de compra (€)"
              value={firstPurchasePrice}
              onChange={(e) =>
                setFirstPurchasePrice(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              type="number"
              fullWidth
            />
            <TextField
              label="Alquiler mensual (€) (opcional)"
              value={firstMonthlyRent}
              onChange={(e) =>
                setFirstMonthlyRent(e.target.value === "" ? "" : Number(e.target.value))
              }
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
            <TextField
              label="Inicio contrato (opcional)"
              value={contractStartDate}
              onChange={(e) => setContractStartDate(e.target.value)}
              placeholder="YYYY-MM-DD"
              fullWidth
            />
            <TextField
              label="Fin contrato (opcional)"
              value={contractEndDate}
              onChange={(e) => setContractEndDate(e.target.value)}
              placeholder="YYYY-MM-DD"
              fullWidth
            />
          </Stack>
        ) : null}

        {activeStep === 3 ? (
          <Stack spacing={2}>
            <TextField
              label="Importe préstamo (opcional)"
              value={financingLoanAmount}
              onChange={(e) =>
                setFinancingLoanAmount(e.target.value === "" ? "" : Number(e.target.value))
              }
              type="number"
              fullWidth
            />
            <TextField
              label="Interés (%) (opcional)"
              value={financingInterestRate}
              onChange={(e) =>
                setFinancingInterestRate(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              type="number"
              fullWidth
            />
            <TextField
              label="Plazo (años) (opcional)"
              value={financingTermYears}
              onChange={(e) =>
                setFinancingTermYears(e.target.value === "" ? "" : Number(e.target.value))
              }
              type="number"
              fullWidth
            />
            <TextField
              label="Banco (opcional)"
              value={financingBank}
              onChange={(e) => setFinancingBank(e.target.value)}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="loan-type-label">Tipo</InputLabel>
              <Select
                labelId="loan-type-label"
                value={financingLoanType}
                label="Tipo"
                onChange={(e) => setFinancingLoanType(String(e.target.value))}
              >
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
