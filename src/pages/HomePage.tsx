import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import { ROICalculator } from "@/components/ROICalculator";
import { formatCurrency } from "@/utils/format";

export function HomePage() {
  const alerts = useMemo(
    () => [
      {
        dot: "warning.main",
        text: "Este mes podrías tener cashflow negativo",
      },
      {
        dot: "info.main",
        text: "Has superado el gasto medio de mantenimiento",
      },
      {
        dot: "error.main",
        text: "Un contrato vence en 30 días",
      },
      {
        dot: "success.main",
        text: "Tu ocupación está en 96% (objetivo 95%)",
      },
    ],
    [],
  );

  const [tickerIndex, setTickerIndex] = useState(0);

  // Live stats that change every 30s
  const [liveStats, setLiveStats] = useState({
    activeUsers: 127,
    totalProperties: 340,
    avgCashflow: 2150,
  });

  // Simple ticker rotation (no libs)
  useEffect(() => {
    const id = window.setInterval(() => {
      setTickerIndex((i) => (i + 1) % alerts.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [alerts.length]);

  // Update live stats every 30s
  useEffect(() => {
    const id = window.setInterval(() => {
      setLiveStats((prev) => ({
        activeUsers: prev.activeUsers + Math.floor(Math.random() * 3) + 1,
        totalProperties:
          prev.totalProperties + Math.floor(Math.random() * 2) + 1,
        avgCashflow: Math.floor(prev.avgCashflow + (Math.random() * 200 - 50)),
      }));
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.50" }}>
      {/* Keyframes + helper styles */}
      <Box
        component="style"
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes floaty {
              0% { transform: translateY(0px); }
              50% { transform: translateY(-8px); }
              100% { transform: translateY(0px); }
            }
            @keyframes fadeSlideUp {
              0% { opacity: 0; transform: translateY(14px); }
              100% { opacity: 1; transform: translateY(0px); }
            }
            @keyframes shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
            @keyframes pulseGlow {
              0% { opacity: .35; transform: scale(1); }
              50% { opacity: .55; transform: scale(1.03); }
              100% { opacity: .35; transform: scale(1); }
            }
          `,
        }}
      />

      {/* Top bar */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              py: 1.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  bgcolor: "primary.main",
                  boxShadow: "0 0 0 6px rgba(25,118,210,0.12)",
                }}
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "rgba(25,118,210,0.10)",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <HomeWorkOutlinedIcon fontSize="small" />
                </Box>

                <Box>
                  <Typography
                    variant="subtitle1"
                    fontWeight={950}
                    lineHeight={1}
                  >
                    Propietario<span style={{ color: "#1976d2" }}>Plus</span>
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    lineHeight={1}
                  >
                    Dashboard de alquileres
                  </Typography>
                </Box>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button component={RouterLink} to="/login" variant="text">
                Entrar
              </Button>
              <Button
                component={RouterLink}
                to="/signup"
                variant="contained"
                sx={{
                  borderRadius: 999,
                  px: 2.2,
                }}
              >
                Crear cuenta gratis
              </Button>
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* Hero background accents */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: -120,
            left: -120,
            width: 360,
            height: 360,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 30% 30%, rgba(25,118,210,0.20), rgba(25,118,210,0) 60%)",
            animation: "pulseGlow 6s ease-in-out infinite",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            bottom: -140,
            right: -140,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 60% 60%, rgba(156,39,176,0.18), rgba(156,39,176,0) 60%)",
            animation: "pulseGlow 7s ease-in-out infinite",
          }}
        />
      </Box>

      <Container
        maxWidth="lg"
        sx={{ py: { xs: 4, md: 8 }, position: "relative" }}
      >
        {/* Hero */}
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={6}>
            <Box sx={{ animation: "fadeSlideUp .6s ease-out both" }}>
              <Chip
                label="🎉 Más de 127 propietarios confían en nosotros"
                color="primary"
                variant="outlined"
                sx={{
                  mb: 2,
                  borderRadius: 999,
                  animation: "pulseGlow 2s ease-in-out infinite",
                }}
              />

              <Typography
                variant="h3"
                component="h1"
                fontWeight={950}
                gutterBottom
                sx={{
                  letterSpacing: -0.6,
                }}
              >
                ¿Realmente sabes cuánto ganas con tus alquileres?
              </Typography>

              <Typography variant="h5" color="text.secondary" sx={{ mb: 1 }}>
                El 73% de propietarios pierden dinero sin darse cuenta.
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
                Descubre tu cashflow real en menos de 60 segundos.
              </Typography>

              {/* Trust indicators */}
              <Stack
                direction="row"
                spacing={3}
                sx={{ mb: 3, opacity: 0.8, flexWrap: "wrap" }}
              >
                <Box display="flex" alignItems="center" gap={1}>
                  <CheckCircleOutlinedIcon
                    fontSize="small"
                    sx={{ color: "success.main" }}
                  />
                  <Typography variant="caption">Sin tarjeta</Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <CheckCircleOutlinedIcon
                    fontSize="small"
                    sx={{ color: "success.main" }}
                  />
                  <Typography variant="caption">
                    Gratis hasta 1 propiedad
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <CheckCircleOutlinedIcon
                    fontSize="small"
                    sx={{ color: "success.main" }}
                  />
                  <Typography variant="caption">
                    Cancela cuando quieras
                  </Typography>
                </Box>
              </Stack>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{ mb: 2 }}
              >
                <Button
                  size="large"
                  variant="contained"
                  component={RouterLink}
                  to="/signup"
                  sx={{
                    borderRadius: 999,
                    px: 3,
                    boxShadow: "0 12px 30px rgba(25,118,210,0.20)",
                    transform: "translateY(0)",
                    transition: "transform .2s ease, box-shadow .2s ease",
                    "&:hover": {
                      transform: "translateY(-1px)",
                      boxShadow: "0 16px 34px rgba(25,118,210,0.26)",
                    },
                  }}
                >
                  Empezar gratis ahora
                </Button>
                <Button
                  size="large"
                  variant="outlined"
                  component={RouterLink}
                  to="/login"
                  sx={{
                    borderRadius: 999,
                    px: 3,
                    transition: "transform .2s ease",
                    "&:hover": {
                      transform: "translateY(-1px)",
                    },
                  }}
                >
                  Ver cómo funciona
                </Button>
              </Stack>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 1, display: "block", mb: 3 }}
              >
                ✓ 14 días de plan Premium de regalo
              </Typography>

              {/* Dynamic metrics */}
              <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                <Box>
                  <Typography variant="h6" fontWeight={900}>
                    {liveStats.activeUsers}+
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Propietarios
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={900}>
                    {liveStats.totalProperties}+
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Propiedades
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight={900}>
                    {formatCurrency(liveStats.avgCashflow)}/mes
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Cashflow promedio
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Grid>

          {/* Wow card */}
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                animation: "fadeSlideUp .7s ease-out both",
                animationDelay: ".08s",
              }}
            >
              <Card
                elevation={0}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 3,
                  overflow: "hidden",
                  position: "relative",
                  transform: "translateY(0)",
                  transition: "transform .25s ease, box-shadow .25s ease",
                  "&:hover": {
                    transform: "translateY(-3px)",
                    boxShadow: "0 18px 45px rgba(0,0,0,0.08)",
                  },
                }}
              >
                {/* subtle animated sheen */}
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(110deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 45%, rgba(255,255,255,0) 70%)",
                    backgroundSize: "220% 100%",
                    animation: "shimmer 7s linear infinite",
                    opacity: 0.35,
                    pointerEvents: "none",
                  }}
                />

                <Box
                  sx={{
                    p: 2.5,
                    bgcolor: "grey.100",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography fontWeight={900}>
                    Vista rápida de tu cartera
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Lo importante, en 10 segundos.
                  </Typography>
                </Box>

                <CardContent sx={{ p: 2.5 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Box
                        sx={{
                          p: 2,
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 2,
                          animation: "floaty 5.4s ease-in-out infinite",
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Cashflow (mes)
                        </Typography>
                        <Typography
                          variant="h5"
                          fontWeight={950}
                          sx={{ mt: 0.5 }}
                        >
                          +€412
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          vs mes anterior: +6%
                        </Typography>
                      </Box>
                    </Grid>

                    <Grid item xs={6}>
                      <Box
                        sx={{
                          p: 2,
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 2,
                          animation: "floaty 6.2s ease-in-out infinite",
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Ocupación
                        </Typography>
                        <Typography
                          variant="h5"
                          fontWeight={950}
                          sx={{ mt: 0.5 }}
                        >
                          96%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          objetivo: 95%
                        </Typography>
                      </Box>
                    </Grid>

                    <Grid item xs={12}>
                      <Box
                        sx={{
                          p: 2,
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 2,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Alertas inteligentes
                        </Typography>

                        {/* ticker */}
                        <Box
                          sx={{
                            mt: 1,
                            p: 1.25,
                            borderRadius: 2,
                            border: "1px solid",
                            borderColor: "divider",
                            bgcolor: "rgba(255,255,255,0.65)",
                            overflow: "hidden",
                          }}
                        >
                          <Box
                            key={tickerIndex}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              animation: "fadeSlideUp .35s ease-out both",
                            }}
                          >
                            <Box
                              sx={{
                                width: 9,
                                height: 9,
                                borderRadius: 999,
                                bgcolor: alerts[tickerIndex].dot,
                              }}
                            />
                            <Typography variant="body2">
                              {alerts[tickerIndex].text}
                            </Typography>
                          </Box>
                        </Box>

                        {/* static list below */}
                        <Stack spacing={1} sx={{ mt: 1.25 }}>
                          {alerts.slice(0, 3).map((a) => (
                            <Box
                              key={a.text}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                opacity: 0.92,
                              }}
                            >
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: 999,
                                  bgcolor: a.dot,
                                }}
                              />
                              <Typography variant="body2">{a.text}</Typography>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* small “live” hint */}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 1.25, textAlign: "center" }}
              >
                *Ejemplo visual — tus datos reales se calculan automáticamente
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* ROI Calculator */}
        <Grid container spacing={3} sx={{ mt: { xs: 4, md: 6 } }}>
          <Grid item xs={12} md={6}>
            <ROICalculator />
          </Grid>
        </Grid>

        {/* Comparison Table Section */}
        <Box sx={{ mt: { xs: 5, md: 8 } }}>
          <Typography
            variant="h4"
            fontWeight={900}
            sx={{ mb: 1, textAlign: "center" }}
          >
            Sin app vs Con PropietarioPlus
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mb: 4, textAlign: "center" }}
          >
            Descubre cómo transformamos tu gestión de alquileres
          </Typography>

          <Box
            sx={{
              overflowX: "auto",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "rgba(25,118,210,0.05)" }}>
                  <th
                    style={{
                      padding: "16px",
                      textAlign: "left",
                      fontWeight: 600,
                      borderBottom: "1px solid rgba(0,0,0,0.12)",
                    }}
                  >
                    Funcionalidad
                  </th>
                  <th
                    style={{
                      padding: "16px",
                      textAlign: "center",
                      fontWeight: 600,
                      borderBottom: "1px solid rgba(0,0,0,0.12)",
                    }}
                  >
                    Sin app
                  </th>
                  <th
                    style={{
                      padding: "16px",
                      textAlign: "center",
                      fontWeight: 600,
                      borderBottom: "1px solid rgba(0,0,0,0.12)",
                    }}
                  >
                    Con PropietarioPlus
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    feature: "Calcular cashflow mensual",
                    without: "⏱️ 2 horas",
                    with: "✅ 2 minutos",
                  },
                  {
                    feature: "Reportes de rentabilidad",
                    without: "❌ Manual en Excel",
                    with: "✅ Automático",
                  },
                  {
                    feature: "Alertas de gastos",
                    without: "❌ No",
                    with: "✅ En tiempo real",
                  },
                  {
                    feature: "Visualizar deuda",
                    without: "⏱️ Muy complejo",
                    with: "✅ Fácil",
                  },
                  {
                    feature: "Proyección futura",
                    without: "❌ No",
                    with: "✅ 12 meses",
                  },
                  {
                    feature: "Impuestos estimados",
                    without: "❌ Manual",
                    with: "✅ Automático",
                  },
                ].map((row, idx) => (
                  <tr
                    key={row.feature}
                    style={{
                      backgroundColor:
                        idx % 2 === 0 ? "rgba(0,0,0,0.01)" : "transparent",
                    }}
                  >
                    <td
                      style={{
                        padding: "14px 16px",
                        borderBottom: "1px solid rgba(0,0,0,0.06)",
                      }}
                    >
                      {row.feature}
                    </td>
                    <td
                      style={{
                        padding: "14px 16px",
                        textAlign: "center",
                        borderBottom: "1px solid rgba(0,0,0,0.06)",
                        color: "rgba(0,0,0,0.6)",
                      }}
                    >
                      {row.without}
                    </td>
                    <td
                      style={{
                        padding: "14px 16px",
                        textAlign: "center",
                        borderBottom: "1px solid rgba(0,0,0,0.06)",
                        fontWeight: 600,
                        color: "#1976d2",
                      }}
                    >
                      {row.with}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Box>

        {/* Pricing Teaser Section */}
        <Box
          sx={{
            mt: { xs: 5, md: 8 },
            p: { xs: 2.5, sm: 4 },
            borderRadius: 3,
            background:
              "linear-gradient(135deg, rgba(25,118,210,0.08) 0%, rgba(25,118,210,0.04) 100%)",
            border: "2px solid",
            borderColor: "primary.light",
            textAlign: "center",
          }}
        >
          <Typography variant="h5" fontWeight={900} sx={{ mb: 1 }}>
            Precio que se ajusta a tu éxito
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Empieza gratis, crece con nosotros
          </Typography>

          <Box
            sx={{
              display: "flex",
              gap: 2,
              justifyContent: "center",
              flexWrap: "wrap",
              mb: 3,
            }}
          >
            <Box
              sx={{
                p: 2.5,
                borderRadius: 2,
                border: "2px solid",
                borderColor: "success.main",
                background:
                  "linear-gradient(135deg, rgba(46,125,50,0.08) 0%, rgba(76,175,80,0.04) 100%)",
                minWidth: 180,
              }}
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                Plan Gratis
              </Typography>
              <Typography
                variant="h6"
                fontWeight={950}
                sx={{
                  background:
                    "linear-gradient(135deg, #2e7d32 0%, #4caf50 100%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  mb: 1,
                }}
              >
                1 Propiedad
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Para empezar sin riesgos
              </Typography>
            </Box>

            <Box
              sx={{
                p: 2.5,
                borderRadius: 2,
                border: "2px solid",
                borderColor: "primary.main",
                background:
                  "linear-gradient(135deg, rgba(25,118,210,0.08) 0%, rgba(66,165,245,0.04) 100%)",
                minWidth: 180,
              }}
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 0.5 }}
              >
                Plan Solo
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "center",
                  gap: 0.5,
                  mb: 1,
                }}
              >
                <Typography
                  variant="h6"
                  fontWeight={950}
                  sx={{
                    background:
                      "linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  4.99€
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  /mes
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Hasta 5 propiedades
              </Typography>
            </Box>
          </Box>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ justifyContent: "center" }}
          >
            <Button
              variant="contained"
              component={RouterLink}
              to="/signup"
              sx={{ borderRadius: 999, px: 3 }}
            >
              Empezar gratis ahora
            </Button>
            <Button
              variant="outlined"
              component={RouterLink}
              to="/demo"
              sx={{ borderRadius: 999, px: 3 }}
            >
              Ver demo (sin registro)
            </Button>
          </Stack>
        </Box>

        {/* Feature blocks (reusing your copy, shorter) */}
        <Grid container spacing={3} sx={{ mt: { xs: 4, md: 6 } }}>
          {[
            {
              title: "📊 Resumen general",
              body: "Número total de viviendas, ingresos, cashflow y ratio de endeudamiento sobre el valor de tus activos.",
            },
            {
              title: "💸 Gastos sin sorpresas",
              body: "Gastos fijos (IBI, comunidad, seguros…) y mantenimiento por vivienda con visión mensual/anual.",
            },
            {
              title: "📈 Flujo de caja y deuda",
              body: "Evolución mes a mes, últimos 12 meses, y deuda amortizada durante el año.",
            },
            {
              title: "📉 Rentabilidad por inversión",
              body: "Equity, cash-on-cash return y cap rate neto por vivienda y para toda la cartera.",
            },
          ].map((f, idx) => (
            <Grid item xs={12} sm={6} key={f.title}>
              <Card
                elevation={0}
                sx={{
                  height: "100%",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 3,
                  transform: "translateY(0)",
                  transition: "transform .25s ease, box-shadow .25s ease",
                  animation: "fadeSlideUp .55s ease-out both",
                  animationDelay: `${0.08 + idx * 0.06}s`,
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "0 16px 36px rgba(0,0,0,0.06)",
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" fontWeight={900} gutterBottom>
                    {f.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {f.body}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Footer links */}
        <Box
          sx={{
            mt: 6,
            pt: 3,
            borderTop: "1px solid",
            borderColor: "divider",
            display: "flex",
            gap: 2,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            © {new Date().getFullYear()} Immo Dashboard
          </Typography>
          <Button component={RouterLink} to="/terms" size="small">
            Términos
          </Button>
          <Button component={RouterLink} to="/privacy" size="small">
            Privacidad
          </Button>

          <Box sx={{ flexGrow: 1 }} />
          <Typography variant="caption" color="text.secondary">
            Hecho para propietarios en España
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
