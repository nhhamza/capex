import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, doc, setDoc } from "firebase/firestore/lite";
import {
  createProperty,
  createLease,
  createLoan,
} from "@/modules/properties/api";
import dayjs from "dayjs";
import { useAuth } from "@/auth/authContext";
import { db } from "@/firebase/client";
import {
  Box,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  TextField,
  Grid,
  CircularProgress,
  MenuItem,
} from "@mui/material";

const steps = [
  "Perfil",
  "Primera Vivienda",
  "Contrato (Opcional)",
  "Financiación (Opcional)",
];

export function OnboardingWizard() {
  const navigate = useNavigate();
  const { user, userDoc, loading: authLoading } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [orgName, setOrgName] = useState("Mi Cartera Inmobiliaria");
  const [saving, setSaving] = useState(false);
  const finishingRef = useRef(false);
  const [checkingProperties, setCheckingProperties] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (authLoading) return;

      // If user already has an orgId, they shouldn't be on /setup-org
      // Redirect immediately to dashboard
      if (userDoc?.organizationId || userDoc?.orgId) {
        navigate("/dashboard", { replace: true });
        return;
      }

      // No orgId - user needs to go through onboarding
      setCheckingProperties(false);
    };

    run();
  }, [authLoading, userDoc, navigate]);

  // Local temp state for first property fields
  const [firstAddress, setFirstAddress] = useState("");
  const [firstPurchasePrice, setFirstPurchasePrice] = useState<number | "">("");
  const [firstMonthlyRent, setFirstMonthlyRent] = useState<number | "">("");

  // Contract information state
  const [contractTenantName, setContractTenantName] = useState("");
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");

  // Financing information state
  const [financingLoanAmount, setFinancingLoanAmount] = useState<number | "">(
    ""
  );
  const [financingInterestRate, setFinancingInterestRate] = useState<
    number | ""
  >("");
  const [financingTermYears, setFinancingTermYears] = useState<number | "">("");
  const [financingBank, setFinancingBank] = useState("");
  const [financingLoanType, setFinancingLoanType] = useState("fixed");

  const handleNext = async () => {
    if (activeStep === steps.length - 1) {
      // Prevent duplicate finish (fast double click before React state updates)
      if (finishingRef.current) {
        console.warn(
          "[Onboarding] Finish already in progress; ignoring duplicate click"
        );
        return;
      }
      finishingRef.current = true;
      // Finish onboarding - create organization if needed
      if (!userDoc?.orgId && user) {
        setSaving(true);
        try {
          const orgRef = await addDoc(collection(db, "organizations"), {
            name: orgName,
            ownerUid: user.uid,
            createdAt: new Date().toISOString(),
          });
          const orgId = orgRef.id;

          await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            orgId,
            role: "owner",
            createdAt: new Date().toISOString(),
          });

          // If user entered a first property, persist it now (with organizationId)
          let createdPropertyId: string | null = null;
          if (
            firstAddress &&
            typeof firstPurchasePrice === "number" &&
            firstPurchasePrice > 0
          ) {
            try {
              const clientRequestId =
                (globalThis as any).crypto?.randomUUID?.() ??
                `${Date.now()}_${Math.random().toString(16).slice(2)}`;
              const newProperty = await createProperty({
                organizationId: orgId,
                address: firstAddress,
                purchasePrice: firstPurchasePrice,
                purchaseDate: dayjs().toISOString(),
                notes: "Creado durante onboarding",
                clientRequestId,
              });
              createdPropertyId = newProperty.id;

              // If contract info provided, create a lease
              if (
                createdPropertyId &&
                (contractTenantName ||
                  contractStartDate ||
                  (typeof firstMonthlyRent === "number" &&
                    firstMonthlyRent > 0))
              ) {
                try {
                  await createLease({
                    propertyId: createdPropertyId,
                    tenantName: contractTenantName || undefined,
                    startDate: contractStartDate
                      ? dayjs(contractStartDate).toISOString()
                      : dayjs().toISOString(),
                    endDate: contractEndDate
                      ? dayjs(contractEndDate).toISOString()
                      : undefined,
                    monthlyRent:
                      typeof firstMonthlyRent === "number"
                        ? firstMonthlyRent
                        : 0,
                    isActive: true,
                  });
                } catch (err) {
                  console.error("[Onboarding] Error creando contrato:", err);
                }
              }

              // If financing info provided, create a loan
              if (
                createdPropertyId &&
                typeof financingLoanAmount === "number" &&
                financingLoanAmount > 0
              ) {
                try {
                  await createLoan({
                    propertyId: createdPropertyId,
                    principal: financingLoanAmount,
                    annualRatePct:
                      typeof financingInterestRate === "number"
                        ? financingInterestRate
                        : 0,
                    termMonths:
                      typeof financingTermYears === "number"
                        ? financingTermYears * 12
                        : 0,
                    notes: `Préstamo ${financingLoanType} - ${
                      financingBank || "No especificado"
                    }`,
                  });
                } catch (err) {
                  console.error(
                    "[Onboarding] Error creando financiación:",
                    err
                  );
                }
              }
            } catch (err) {
              console.error(
                "[Onboarding] Error creando primera vivienda:",
                err
              );
            }
          }

          // Wait briefly then redirect (full reload to ensure context picks new org)
          setTimeout(() => {
            if (createdPropertyId) {
              window.location.href = `/properties/${createdPropertyId}`;
            } else {
              window.location.href = "/properties";
            }
          }, 700);
        } catch (err) {
          console.error("Error creating organization:", err);
          alert("Error al crear organización. Por favor, intenta de nuevo.");
        } finally {
          setSaving(false);
          finishingRef.current = false;
        }
      } else {
        // Organization already exists; optionally create property under existing org
        let createdPropertyId: string | null = null;
        if (
          userDoc?.orgId &&
          firstAddress &&
          typeof firstPurchasePrice === "number" &&
          firstPurchasePrice > 0
        ) {
          try {
            setSaving(true);
            const clientRequestId =
              (globalThis as any).crypto?.randomUUID?.() ??
              `${Date.now()}_${Math.random().toString(16).slice(2)}`;
            const newProperty = await createProperty({
              organizationId: userDoc.orgId,
              address: firstAddress,
              purchasePrice: firstPurchasePrice,
              purchaseDate: dayjs().toISOString(),
              notes: "Creado durante onboarding (org existente)",
              clientRequestId,
            });
            createdPropertyId = newProperty.id;

            // If contract info provided, create a lease
            if (
              createdPropertyId &&
              (contractTenantName ||
                contractStartDate ||
                (typeof firstMonthlyRent === "number" && firstMonthlyRent > 0))
            ) {
              try {
                await createLease({
                  propertyId: createdPropertyId,
                  tenantName: contractTenantName || undefined,
                  startDate: contractStartDate
                    ? dayjs(contractStartDate).toISOString()
                    : dayjs().toISOString(),
                  endDate: contractEndDate
                    ? dayjs(contractEndDate).toISOString()
                    : undefined,
                  monthlyRent:
                    typeof firstMonthlyRent === "number" ? firstMonthlyRent : 0,
                  isActive: true,
                });
              } catch (err) {
                console.error("[Onboarding] Error creando contrato:", err);
              }
            }

            // If financing info provided, create a loan
            if (
              createdPropertyId &&
              typeof financingLoanAmount === "number" &&
              financingLoanAmount > 0
            ) {
              try {
                await createLoan({
                  propertyId: createdPropertyId,
                  principal: financingLoanAmount,
                  annualRatePct:
                    typeof financingInterestRate === "number"
                      ? financingInterestRate
                      : 0,
                  termMonths:
                    typeof financingTermYears === "number"
                      ? financingTermYears * 12
                      : 0,
                  notes: `Préstamo ${financingLoanType} - ${
                    financingBank || "No especificado"
                  }`,
                });
              } catch (err) {
                console.error("[Onboarding] Error creando financiación:", err);
              }
            }
          } catch (err) {
            console.error(
              "[Onboarding] Error creando primera vivienda (org existente):",
              err
            );
          } finally {
            setSaving(false);
            finishingRef.current = false;
          }
        }

        // If we didn't hit the saving flow above (e.g. no first property),
        // ensure we release the finish lock before navigating.
        if (!saving) {
          finishingRef.current = false;
        }

        // Navigate to the created property or properties list
        if (createdPropertyId) {
          navigate(`/properties/${createdPropertyId}`);
        } else {
          navigate("/properties");
        }
      }
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSkip = async () => {
    if (!userDoc?.orgId && user) {
      setSaving(true);
      try {
        const orgRef = await addDoc(collection(db, "organizations"), {
          name: orgName,
          ownerUid: user.uid,
          createdAt: new Date().toISOString(),
        });
        const orgId = orgRef.id;

        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          orgId,
          role: "owner",
          createdAt: new Date().toISOString(),
        });

        setTimeout(() => {
          window.location.href = "/dashboard";
        }, 500);
      } catch (err) {
        console.error("Error creating organization:", err);
        alert("Error al crear organización. Por favor, intenta de nuevo.");
      } finally {
        setSaving(false);
      }
    } else {
      navigate("/dashboard");
    }
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

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "grey.100",
        p: 2,
      }}
    >
      <Paper sx={{ maxWidth: 800, width: "100%", p: 4 }}>
        <Typography variant="h4" gutterBottom align="center">
          Configuración Inicial
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mt: 4, mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ minHeight: 300 }}>
          {activeStep === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Perfil de la Organización
              </Typography>
              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Nombre de tu cartera"
                    placeholder="Ej: Mi Cartera Inmobiliaria"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="País"
                    defaultValue="España"
                    disabled
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {activeStep === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Añadir Primera Vivienda (Opcional)
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Puedes añadir tu primera vivienda ahora o saltarte este paso.
              </Typography>
              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Dirección"
                    value={firstAddress}
                    onChange={(e) => setFirstAddress(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Precio de Compra (€)"
                    type="number"
                    value={firstPurchasePrice}
                    onChange={(e) =>
                      setFirstPurchasePrice(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Renta Alquiler Mensual (€)"
                    type="number"
                    value={firstMonthlyRent}
                    onChange={(e) =>
                      setFirstMonthlyRent(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    helperText="(Puedes añadir el contrato en el siguiente paso)"
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {activeStep === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Información del Contrato de Arrendamiento (Opcional)
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Añade los detalles del contrato de alquiler. Puedes completarlo
                más tarde si prefieres.
              </Typography>
              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Nombre del Arrendatario"
                    placeholder="Ej: Juan García López"
                    value={contractTenantName}
                    onChange={(e) => setContractTenantName(e.target.value)}
                    helperText="(Opcional)"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Fecha de Inicio del Contrato"
                    type="date"
                    value={contractStartDate}
                    onChange={(e) => setContractStartDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Fecha de Fin del Contrato"
                    type="date"
                    value={contractEndDate}
                    onChange={(e) => setContractEndDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {activeStep === 3 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Información de Financiación (Opcional)
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Añade los detalles de tu hipoteca o préstamo. Puedes completarlo
                más tarde si prefieres.
              </Typography>
              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Importe del Préstamo (€)"
                    type="number"
                    value={financingLoanAmount}
                    onChange={(e) =>
                      setFinancingLoanAmount(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    helperText="(Opcional)"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Tipo de Préstamo"
                    select
                    value={financingLoanType}
                    onChange={(e) => setFinancingLoanType(e.target.value)}
                  >
                    <MenuItem value="fixed">Hipoteca de tipo fijo</MenuItem>
                    <MenuItem value="variable">
                      Hipoteca de tipo variable
                    </MenuItem>
                    <MenuItem value="mixed">Hipoteca mixta</MenuItem>
                    <MenuItem value="personal">Préstamo personal</MenuItem>
                    <MenuItem value="other">Otro</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Tipo de Interés Anual (%)"
                    type="number"
                    inputProps={{ step: "0.01" }}
                    value={financingInterestRate}
                    onChange={(e) =>
                      setFinancingInterestRate(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    helperText="(Ej: 3.5)"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Plazo del Préstamo (Años)"
                    type="number"
                    value={financingTermYears}
                    onChange={(e) =>
                      setFinancingTermYears(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    helperText="(Ej: 25, 30)"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Entidad Financiera"
                    placeholder="Ej: Banco Bilbao Vizcaya Argentaria"
                    value={financingBank}
                    onChange={(e) => setFinancingBank(e.target.value)}
                    helperText="(Opcional)"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </Box>

        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}>
          <Button onClick={handleSkip} color="inherit" disabled={saving}>
            Saltar
          </Button>
          <Box sx={{ display: "flex", gap: 1 }}>
            {activeStep > 0 && (
              <Button onClick={handleBack} disabled={saving}>
                Atrás
              </Button>
            )}
            <Button variant="contained" onClick={handleNext} disabled={saving}>
              {saving
                ? "Guardando..."
                : activeStep === steps.length - 1
                ? "Finalizar"
                : "Siguiente"}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
