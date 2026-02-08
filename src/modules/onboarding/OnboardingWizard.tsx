import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { useAuth } from "@/auth/authContext";
import {
  getProperties,
  createProperty,
  createLease,
  createLoan,
  createRecurringExpense,
} from "@/modules/properties/api";
import {
  Box,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
  LinearProgress,
  Snackbar,
  Paper,
} from "@mui/material";

/**
 * IMPORTANT:
 * - This wizard must NEVER create organizations or user profiles.
 * - Org/profile creation happens ONLY during SignUp via POST /api/signup/initialize.
 * - Here we only help users create their first property (if they have an org but zero properties).
 */

const steps = [
  "Tu primera propiedad",
  "¿Tienes hipoteca?",
  "Gastos fijos mensuales",
];

interface DemoProperty {
  address: string;
  purchasePrice: number;
  monthlyRent: number;
  mortgageAmount?: number;
  mortgageInterestRate?: number;
  ibiAnnual?: number;
  communityMonthly?: number;
  insuranceAnnual?: number;
}

const DEMO_PORTFOLIO: DemoProperty[] = [
  {
    address: "Apartamento Centro, Madrid - Calle Gran Vía 45",
    purchasePrice: 250000,
    monthlyRent: 1200,
    mortgageAmount: 175000,
    mortgageInterestRate: 3.5,
    ibiAnnual: 750,
    communityMonthly: 120,
    insuranceAnnual: 300,
  },
  {
    address: "Estudio Zona Universidad, Barcelona",
    purchasePrice: 180000,
    monthlyRent: 750,
    mortgageAmount: 120000,
    mortgageInterestRate: 3.2,
    ibiAnnual: 500,
    communityMonthly: 80,
    insuranceAnnual: 200,
  },
  {
    address: "Casa Rural Levante, Valencia",
    purchasePrice: 150000,
    monthlyRent: 600,
    ibiAnnual: 400,
    communityMonthly: 0,
    insuranceAnnual: 250,
  },
];

export function OnboardingWizard() {
  const navigate = useNavigate();
  const { userDoc, loading: authLoading, needsOnboarding, logout } = useAuth();

  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const finishingRef = useRef(false);

  const [checkingProperties, setCheckingProperties] = useState(true);
  const [error, setError] = useState<string>("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState(
    "🎉 ¡Tu primera propiedad está lista!",
  );

  // Step 1: First property
  const [firstAddress, setFirstAddress] = useState("");
  const [firstPurchasePrice, setFirstPurchasePrice] = useState<number | "">("");
  const [firstMonthlyRent, setFirstMonthlyRent] = useState<number | "">("");

  // Step 2: Financing (optional)
  const [hasFinancing, setHasFinancing] = useState(false);
  const [financingLoanAmount, setFinancingLoanAmount] = useState<number | "">(
    "",
  );
  const [financingInterestRate, setFinancingInterestRate] = useState<
    number | ""
  >("");

  // Step 3: Recurring expenses (optional)
  const [ibiAnnual, setIbiAnnual] = useState<number | "">("");
  const [communityMonthly, setCommunityMonthly] = useState<number | "">("");
  const [insuranceAnnual, setInsuranceAnnual] = useState<number | "">("");

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

  // Validaciones por paso
  const isStep1Valid =
    firstAddress &&
    typeof firstPurchasePrice === "number" &&
    firstPurchasePrice > 0;
  const isStep2Valid =
    !hasFinancing ||
    (typeof financingLoanAmount === "number" && financingLoanAmount > 0);

  const createPropertyWithData = async (prop: DemoProperty) => {
    if (!orgId) {
      throw new Error("No organization");
    }

    const clientRequestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    // Create property
    const newProperty = await createProperty({
      organizationId: orgId,
      address: prop.address,
      purchasePrice: prop.purchasePrice,
      purchaseDate: dayjs().toISOString(),
      notes: "Creado durante onboarding",
      rentalMode: "ENTIRE_UNIT", // Default to full unit rental
      clientRequestId,
    });

    const propertyId = newProperty.id;

    // Create lease with monthly rent
    if (propertyId && prop.monthlyRent > 0) {
      try {
        await createLease({
          propertyId,
          tenantName: "Inquilino",
          startDate: dayjs().toISOString(),
          monthlyRent: prop.monthlyRent,
        });
      } catch (leaseErr) {
        console.warn("[Onboarding] Lease creation failed:", leaseErr);
      }
    }

    // Create loan if financing exists
    if (propertyId && prop.mortgageAmount && prop.mortgageAmount > 0) {
      try {
        await createLoan({
          propertyId,
          principal: prop.mortgageAmount,
          annualRatePct: prop.mortgageInterestRate || 3.5,
          termMonths: 360, // Default 30 years
          startDate: dayjs().toISOString(),
          interestOnlyMonths: 0,
          upFrontFees: 0,
        });
      } catch (loanErr) {
        console.warn("[Onboarding] Loan creation failed:", loanErr);
      }
    }

    // Create recurring expenses if provided
    if (propertyId) {
      try {
        if (prop.ibiAnnual && prop.ibiAnnual > 0) {
          await createRecurringExpense({
            propertyId,
            type: "ibi",
            amount: prop.ibiAnnual,
            periodicity: "yearly",
            isDeductible: true,
          });
        }
        if (prop.communityMonthly && prop.communityMonthly > 0) {
          await createRecurringExpense({
            propertyId,
            type: "community",
            amount: prop.communityMonthly,
            periodicity: "monthly",
            isDeductible: true,
          });
        }
        if (prop.insuranceAnnual && prop.insuranceAnnual > 0) {
          await createRecurringExpense({
            propertyId,
            type: "insurance",
            amount: prop.insuranceAnnual,
            periodicity: "yearly",
            isDeductible: true,
          });
        }
      } catch (expenseErr) {
        console.warn(
          "[Onboarding] Recurring expense creation failed:",
          expenseErr,
        );
      }
    }
  };

  const handleNext = async () => {
    // Validación del step actual
    if (activeStep === 0 && !isStep1Valid) {
      setError("Por favor, completa la dirección y el precio de compra");
      return;
    }

    if (activeStep === 1 && !isStep2Valid) {
      setError(
        "Por favor, completa el importe del préstamo si tienes hipoteca",
      );
      return;
    }

    if (activeStep < steps.length - 1) {
      setError("");
      setActiveStep((s) => s + 1);
      return;
    }

    // Finish - save everything
    if (finishingRef.current) return;
    finishingRef.current = true;

    if (!orgId) {
      setError(
        "Tu cuenta aún no está inicializada (no hay organización asociada).",
      );
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

      // Create property
      const newProperty = await createProperty({
        organizationId: orgId,
        address: firstAddress,
        purchasePrice: firstPurchasePrice as number,
        purchaseDate: dayjs().toISOString(),
        notes: "Creado durante onboarding",
        rentalMode: "ENTIRE_UNIT", // Default to full unit rental
        clientRequestId,
      });

      const propertyId = newProperty.id;

      // Create lease with monthly rent
      if (
        propertyId &&
        typeof firstMonthlyRent === "number" &&
        firstMonthlyRent > 0
      ) {
        try {
          await createLease({
            propertyId,
            tenantName: "Inquilino",
            startDate: dayjs().toISOString(),
            monthlyRent: firstMonthlyRent,
          });
        } catch (leaseErr) {
          console.warn("[Onboarding] Lease creation failed:", leaseErr);
        }
      }

      // Create loan if financing is set
      if (
        propertyId &&
        hasFinancing &&
        typeof financingLoanAmount === "number" &&
        financingLoanAmount > 0
      ) {
        try {
          await createLoan({
            propertyId,
            principal: financingLoanAmount,
            annualRatePct:
              typeof financingInterestRate === "number"
                ? financingInterestRate
                : 3.5,
            termMonths: 360, // Default 30 years
            startDate: dayjs().toISOString(),
            interestOnlyMonths: 0,
            upFrontFees: 0,
          });
        } catch (loanErr) {
          console.warn("[Onboarding] Loan creation failed:", loanErr);
        }
      }

      // Create recurring expenses if provided
      if (propertyId) {
        try {
          if (typeof ibiAnnual === "number" && ibiAnnual > 0) {
            await createRecurringExpense({
              propertyId,
              type: "ibi",
              amount: ibiAnnual,
              periodicity: "yearly",
              isDeductible: true,
            });
          }
          if (typeof communityMonthly === "number" && communityMonthly > 0) {
            await createRecurringExpense({
              propertyId,
              type: "community",
              amount: communityMonthly,
              periodicity: "monthly",
              isDeductible: true,
            });
          }
          if (typeof insuranceAnnual === "number" && insuranceAnnual > 0) {
            await createRecurringExpense({
              propertyId,
              type: "insurance",
              amount: insuranceAnnual,
              periodicity: "yearly",
              isDeductible: true,
            });
          }
        } catch (expenseErr) {
          console.warn(
            "[Onboarding] Recurring expense creation failed:",
            expenseErr,
          );
        }
      }

      setSuccessMessage("🎉 ¡Tu primera propiedad está lista!");
      setShowSuccess(true);
      setTimeout(() => {
        navigate("/dashboard?onboarding=done", { replace: true });
      }, 1500);
    } catch (err) {
      console.error("[Onboarding] Finish failed:", err);
      setError(
        "Error al crear tu primera vivienda. Por favor, intenta de nuevo.",
      );
    } finally {
      setSaving(false);
      finishingRef.current = false;
    }
  };

  const handleLoadDemoPortfolio = async () => {
    if (finishingRef.current || !orgId) return;
    finishingRef.current = true;

    setSaving(true);
    setError("");

    try {
      for (const prop of DEMO_PORTFOLIO) {
        await createPropertyWithData(prop);
      }

      setSuccessMessage(
        `🎉 ¡${DEMO_PORTFOLIO.length} propiedades de demostración cargadas!`,
      );
      setShowSuccess(true);

      setTimeout(() => {
        navigate("/dashboard?onboarding=done&demo=true", { replace: true });
      }, 1500);
    } catch (err) {
      console.error("[Onboarding] Demo portfolio failed:", err);
      setError(
        "Error al cargar el portfolio de demostración. Por favor, intenta de nuevo.",
      );
    } finally {
      setSaving(false);
      finishingRef.current = false;
    }
  };

  const handleBack = () => setActiveStep((s) => Math.max(0, s - 1));
  const handleSkip = () => navigate("/dashboard", { replace: true });

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

  if (needsOnboarding || !orgId) {
    return (
      <Box sx={{ maxWidth: 720, mx: "auto", px: 2, py: 6 }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Completa tu registro
          </Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Tu cuenta todavía no tiene una organización asociada. Por seguridad,
            no creamos una nueva automáticamente.
          </Alert>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Por favor, cierra sesión y crea tu cuenta desde la pantalla de
            registro (Sign Up).
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
    <Box sx={{ maxWidth: 800, mx: "auto", px: 2, py: 4 }}>
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" gutterBottom fontWeight={700}>
            🏠 Añade tu primera propiedad
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: "text.secondary" }}>
            Solo necesitamos 3 datos para empezar
          </Typography>

          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}

          {/* Progress */}
          <Box sx={{ mb: 3 }}>
            <Box
              sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}
            >
              <Typography variant="caption" color="text.secondary">
                {`Paso ${activeStep + 1} de ${steps.length}`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {activeStep === 0 && "⏱️ 30 segundos"}
                {activeStep === 1 && "⏱️ 15 segundos"}
                {activeStep === 2 && "⏱️ 30 segundos"}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={((activeStep + 1) / steps.length) * 100}
            />
          </Box>

          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* STEP 1: First property */}
          {activeStep === 0 && (
            <Stack spacing={2.5}>
              <Typography variant="subtitle2" fontWeight={700}>
                Información básica
              </Typography>
              <TextField
                fullWidth
                label="Dirección o nombre"
                placeholder="Calle Principal 123, Madrid"
                value={firstAddress}
                onChange={(e) => setFirstAddress(e.target.value)}
                required
              />
              <TextField
                fullWidth
                label="Precio de compra"
                type="number"
                placeholder="150000"
                value={firstPurchasePrice}
                onChange={(e) =>
                  setFirstPurchasePrice(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                InputProps={{ endAdornment: "€" }}
                required
              />
              <TextField
                fullWidth
                label="Alquiler mensual"
                type="number"
                placeholder="750"
                value={firstMonthlyRent}
                onChange={(e) =>
                  setFirstMonthlyRent(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                InputProps={{ endAdornment: "€/mes" }}
              />
            </Stack>
          )}

          {/* STEP 2: Financing */}
          {activeStep === 1 && (
            <Stack spacing={2.5}>
              <FormControlLabel
                control={
                  <Switch
                    checked={hasFinancing}
                    onChange={(e) => setHasFinancing(e.target.checked)}
                  />
                }
                label="¿Esta propiedad tiene hipoteca?"
              />

              {hasFinancing && (
                <>
                  <TextField
                    fullWidth
                    label="Cantidad del préstamo"
                    type="number"
                    placeholder="120000"
                    value={financingLoanAmount}
                    onChange={(e) =>
                      setFinancingLoanAmount(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    InputProps={{ endAdornment: "€" }}
                  />
                  <TextField
                    fullWidth
                    label="Tipo de interés"
                    type="number"
                    placeholder="3.5"
                    value={financingInterestRate}
                    onChange={(e) =>
                      setFinancingInterestRate(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    InputProps={{ endAdornment: "% anual" }}
                  />
                </>
              )}

              {!hasFinancing && (
                <Alert severity="info">
                  Puedes añadirlo después en la sección de propiedades
                </Alert>
              )}
            </Stack>
          )}

          {/* STEP 3: Recurring expenses */}
          {activeStep === 2 && (
            <Stack spacing={2.5}>
              <Typography variant="subtitle2" fontWeight={700}>
                Gastos que pagas cada mes/año (opcional)
              </Typography>

              <TextField
                fullWidth
                label="IBI anual"
                type="number"
                placeholder="600"
                value={ibiAnnual}
                onChange={(e) =>
                  setIbiAnnual(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                InputProps={{ endAdornment: "€/año" }}
                helperText="Divide entre 12 para ver el mensual"
              />

              <TextField
                fullWidth
                label="Comunidad mensual"
                type="number"
                placeholder="80"
                value={communityMonthly}
                onChange={(e) =>
                  setCommunityMonthly(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                InputProps={{ endAdornment: "€/mes" }}
              />

              <TextField
                fullWidth
                label="Seguro anual"
                type="number"
                placeholder="250"
                value={insuranceAnnual}
                onChange={(e) =>
                  setInsuranceAnnual(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                InputProps={{ endAdornment: "€/año" }}
              />

              <Alert severity="info">
                Todos los campos son opcionales - puedes añadirlos después
              </Alert>
            </Stack>
          )}

          {/* Buttons */}
          <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
            <Button
              disabled={activeStep === 0 || saving}
              onClick={handleBack}
              variant="outlined"
            >
              Atrás
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button disabled={saving} onClick={handleSkip} variant="text">
              Saltar
            </Button>
            <Button
              variant="contained"
              disabled={
                saving ||
                (activeStep === 0 && !isStep1Valid) ||
                (activeStep === 1 && !isStep2Valid)
              }
              onClick={handleNext}
              size="large"
            >
              {activeStep === steps.length - 1
                ? "Crear mi primera propiedad"
                : "Continuar"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Demo Data Section */}
      <Paper
        sx={{
          p: 3,
          mt: 3,
          bgcolor: "rgba(33, 150, 243, 0.08)",
          border: "1px solid rgba(33, 150, 243, 0.2)",
        }}
      >
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          ✨ Prueba con datos de demostración
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Carga un portfolio de ejemplo con {DEMO_PORTFOLIO.length} propiedades
          para explorar todas las características
        </Typography>
        <Button
          variant="contained"
          color="primary"
          disabled={saving}
          onClick={handleLoadDemoPortfolio}
          fullWidth
        >
          {saving ? "Cargando..." : "Usar datos de ejemplo"}
        </Button>
      </Paper>

      {/* Success Snackbar */}
      <Snackbar
        open={showSuccess}
        autoHideDuration={1500}
        message={successMessage}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
