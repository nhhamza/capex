import { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Alert,
  CircularProgress,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import { useAuth } from "@/auth/authContext";
import { useOrgLimits } from "@/hooks/useOrgLimits";
import { openExternal } from "@/lib/openExternal";
import { useLocation } from "react-router-dom";

// Backend API URL
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const plans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "siempre",
    color: "default" as const,
    features: [
      "1 vivienda",
      "Seguimiento básico de gastos",
      "Reportes limitados",
    ],
    limits: "Sin exportaciones",
  },
  {
    id: "solo",
    name: "Solo",
    price: 0.99,
    period: "mes",
    color: "primary" as const,
    features: [
      "Hasta 5 viviendas",
      "Todos los tipos de gastos",
      "Exportación Excel y PDF",
      "Métricas avanzadas",
    ],
    recommended: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: 1.99,
    period: "mes",
    color: "secondary" as const,
    features: [
      "Hasta 20 viviendas",
      "Todo de Solo +",
      "Reportes personalizados",
      "API access",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    price: 8.99,
    period: "mes",
    color: "error" as const,
    features: [
      "Viviendas ilimitadas",
      "Todo de Pro +",
      "Multi-organización",
      "Gestión de clientes",
      "Onboarding personalizado",
    ],
  },
];

export function BillingPage() {
  const location = useLocation();
  const blocked = Boolean((location as any).state?.blocked);

  const { userDoc } = useAuth();
  const { loading: planLoading, plan, refresh } = useOrgLimits(userDoc?.orgId);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refresh plan data when page loads (in case it was just updated)
  useEffect(() => {
    if (userDoc?.orgId) {
      console.log("🔄 BillingPage: Refreshing org limits on mount");
      refresh();
    }
  }, [userDoc?.orgId]); // Only run when orgId changes, not on every render

  const handleUpgrade = async (planId: string) => {
    setProcessingPlan(planId);
    setError(null);

    try {
      if (!userDoc?.orgId) {
        throw new Error("Organization ID not found");
      }

      // Map planId to priceId - real Stripe Price IDs from dashboard
      const planToPrice: Record<string, string> = {
        solo: "price_1SRy7v1Ooy6ryYPn2mc6FKfu",
        pro: "price_1SRyIm1Ooy6ryYPnczGBTB7g",
        agency: "price_1SRyMA1Ooy6ryYPnzPLHOkWt",
      };

      const priceId = planToPrice[planId];
      if (!priceId) throw new Error("Invalid plan for checkout");

      // Call Express backend instead of Firebase Functions
      const response = await fetch(`${API_URL}/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orgId: userDoc.orgId,
          priceId,
          successUrl: import.meta.env.VITE_CHECKOUT_SUCCESS_URL,
          cancelUrl: import.meta.env.VITE_CHECKOUT_CANCEL_URL,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const data = await response.json();
      await openExternal(data.url);
    } catch (err: any) {
      console.error("Error creating checkout session:", err);
      setError(
        err.message ||
          "Error al iniciar el proceso de pago. Inténtalo de nuevo."
      );
      setProcessingPlan(null);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Planes y Facturación
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Elige el plan que mejor se adapte a tus necesidades
      </Typography>

      {blocked && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Tu suscripción no está al día. Para seguir usando la app, actualiza tu
          pago o cambia de plan.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {planLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 3 }}>
            Plan actual: <strong>{plan ? plan.toUpperCase() : "FREE"}</strong>
          </Alert>

          <Grid container spacing={3}>
            {plans.map((planOption) => {
              const isCurrentPlan = plan === planOption.id;
              const isProcessing = processingPlan === planOption.id;

              // Determine plan hierarchy
              const planHierarchy = ["free", "solo", "pro", "agency"];
              const currentPlanIndex = planHierarchy.indexOf(plan || "free");
              const optionPlanIndex = planHierarchy.indexOf(planOption.id);
              const isUpgrade = optionPlanIndex > currentPlanIndex;
              const isDowngrade = optionPlanIndex < currentPlanIndex;

              return (
                <Grid item xs={12} sm={6} md={3} key={planOption.id}>
                  <Card
                    sx={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      position: "relative",
                      border: planOption.recommended ? 2 : 1,
                      borderColor: planOption.recommended
                        ? "primary.main"
                        : "divider",
                      opacity: isDowngrade ? 0.7 : 1,
                    }}
                  >
                    {planOption.recommended && !isCurrentPlan && isUpgrade && (
                      <Chip
                        label="Recomendado"
                        color="primary"
                        size="small"
                        sx={{
                          position: "absolute",
                          top: 16,
                          right: 16,
                        }}
                      />
                    )}
                    {isCurrentPlan && (
                      <Chip
                        label="Plan Actual"
                        color="success"
                        size="small"
                        sx={{
                          position: "absolute",
                          top: 16,
                          left: 16,
                        }}
                      />
                    )}
                    <CardContent sx={{ flexGrow: 1, pt: 4 }}>
                      <Typography variant="h5" component="div" gutterBottom>
                        {planOption.name}
                      </Typography>
                      <Box sx={{ mb: 2 }}>
                        <Typography
                          variant="h3"
                          component="span"
                          color="primary"
                        >
                          €{planOption.price}
                        </Typography>
                        <Typography
                          variant="body2"
                          component="span"
                          color="text.secondary"
                        >
                          /{planOption.period}
                        </Typography>
                      </Box>
                      <List dense>
                        {planOption.features.map((feature, index) => (
                          <ListItem key={index} disableGutters>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <CheckIcon color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary={feature}
                              primaryTypographyProps={{ variant: "body2" }}
                            />
                          </ListItem>
                        ))}
                      </List>
                      {planOption.limits && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mt: 1 }}
                        >
                          ⚠️ {planOption.limits}
                        </Typography>
                      )}
                    </CardContent>
                    <CardActions sx={{ p: 2 }}>
                      {isCurrentPlan ? (
                        <Button fullWidth disabled variant="outlined">
                          Plan Actual
                        </Button>
                      ) : planOption.id === "free" ? (
                        <Button
                          fullWidth
                          disabled
                          variant="outlined"
                          color="inherit"
                        >
                          Plan Gratuito
                        </Button>
                      ) : isDowngrade ? (
                        <Button
                          fullWidth
                          variant="text"
                          color="inherit"
                          disabled
                          sx={{ opacity: 0.5 }}
                        >
                          Cambiar a {planOption.name}
                        </Button>
                      ) : (
                        <Button
                          fullWidth
                          variant={isUpgrade ? "contained" : "outlined"}
                          color={
                            planOption.color === "default"
                              ? "primary"
                              : planOption.color
                          }
                          onClick={() => handleUpgrade(planOption.id)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <CircularProgress size={24} />
                          ) : (
                            "Mejorar Plan"
                          )}
                        </Button>
                      )}
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          <Paper sx={{ p: 3, mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Información de Pago
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              • Los pagos se procesan de forma segura a través de Stripe
              <br />
              • Puedes cancelar o cambiar tu plan en cualquier momento
              <br />
              • Los cambios de plan se aplican inmediatamente
              <br />
              • Reembolso completo si cancelas en los primeros 14 días
              <br />• Aceptamos tarjetas de crédito y débito
            </Typography>
          </Paper>
        </>
      )}
    </Box>
  );
}
