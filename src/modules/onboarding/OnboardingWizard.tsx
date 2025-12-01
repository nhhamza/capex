import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, doc, setDoc } from "firebase/firestore/lite";
import { createProperty } from "@/modules/properties/api";
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
} from "@mui/material";

const steps = ["Perfil", "Parámetros", "Primera Vivienda"];

export function OnboardingWizard() {
  const navigate = useNavigate();
  const { user, userDoc, loading: authLoading } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [orgName, setOrgName] = useState("Mi Cartera Inmobiliaria");
  const [saving, setSaving] = useState(false);

  // If user already has an org, redirect to dashboard
  useEffect(() => {
    if (!authLoading && userDoc?.orgId) {
      navigate("/dashboard");
    }
  }, [authLoading, userDoc, navigate]);

  // Local temp state for first property fields
  const [firstAddress, setFirstAddress] = useState("");
  const [firstPurchasePrice, setFirstPurchasePrice] = useState<number | "">("");
  const [firstMonthlyRent, setFirstMonthlyRent] = useState<number | "">("");

  const handleNext = async () => {
    if (activeStep === steps.length - 1) {
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
              const newProperty = await createProperty({
                organizationId: orgId,
                address: firstAddress,
                purchasePrice: firstPurchasePrice,
                purchaseDate: dayjs().toISOString(),
                notes: "Creado durante onboarding",
              });
              createdPropertyId = newProperty.id;
            } catch (err) {
              console.error(
                "[Onboarding] Error creando primera vivienda:",
                err
              );
            }
          }
          // If rent provided also could create a lease later (future enhancement)

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
            const newProperty = await createProperty({
              organizationId: userDoc.orgId,
              address: firstAddress,
              purchasePrice: firstPurchasePrice,
              purchaseDate: dayjs().toISOString(),
              notes: "Creado durante onboarding (org existente)",
            });
            createdPropertyId = newProperty.id;
          } catch (err) {
            console.error(
              "[Onboarding] Error creando primera vivienda (org existente):",
              err
            );
          } finally {
            setSaving(false);
          }
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

  if (authLoading) {
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
                Parámetros por Defecto
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Estos valores se usarán como base para nuevas viviendas. Podrás
                cambiarlos más tarde.
              </Typography>
              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="% ITP"
                    type="number"
                    defaultValue="10"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="% Vacancia"
                    type="number"
                    defaultValue="5"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Gastos Notaría (€)"
                    type="number"
                    defaultValue="1200"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Gastos Registro (€)"
                    type="number"
                    defaultValue="800"
                  />
                </Grid>
              </Grid>
            </Box>
          )}

          {activeStep === 2 && (
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
                    label="Renta Alquier Mensual (€)"
                    type="number"
                    value={firstMonthlyRent}
                    onChange={(e) =>
                      setFirstMonthlyRent(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    helperText="(Guardaremos la vivienda; el contrato se añade luego)"
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
