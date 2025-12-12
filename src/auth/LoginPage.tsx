import { useState, useEffect } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase/client";
import { useAuth } from "./authContext";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Link,
  Chip,
} from "@mui/material";

export function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // AuthProvider will handle navigation after user doc is loaded
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: { xs: "flex-start", md: "center" },
        justifyContent: "center",
        bgcolor: "grey.100",
        py: 4,
      }}
    >
      <Box
        sx={{
          maxWidth: 1200,
          width: "100%",
          mx: 2,
          display: "flex",
          gap: 4,
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "stretch", md: "center" },
        }}
      >
        {/* Marketing / Features Section */}
        <Box
          sx={{
            flex: 1,
            order: { xs: 2, md: 1 },
            width: "100%",
          }}
        >
          <Chip
            label="Beta privada para propietarios e inversores"
            color="primary"
            variant="outlined"
            sx={{ mb: 2 }}
          />

          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            fontWeight="bold"
          >
            Controla tus pisos de alquiler en un solo sitio
          </Typography>

          <Typography variant="h6" color="primary" gutterBottom sx={{ mb: 3 }}>
            Dashboard de gestión inmobiliaria para inversiones en España
          </Typography>

          <Typography variant="body1" paragraph>
            Deja de pelearte con Excel. Centraliza tus viviendas, ingresos,
            gastos e hipotecas y entiende, de verdad,{" "}
            <strong>cuánto te está dejando cada piso al mes y al año</strong>.
          </Typography>

          <Box sx={{ mt: 3 }}>
            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1 }}
            >
              📊 Resumen General de tu cartera
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              paragraph
              sx={{ ml: 4 }}
            >
              • Número total de viviendas en alquiler
              <br />
              • Ingresos anuales totales por rentas
              <br />
              • Cash Flow anual (después de gastos e hipotecas)
              <br />• Ratio de endeudamiento sobre el valor de tus activos
            </Typography>

            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2 }}
            >
              💸 Control de gastos sin sorpresas
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              paragraph
              sx={{ ml: 4 }}
            >
              • Gastos fijos (IBI, comunidad, seguros…)
              <br />
              • Mantenimiento y reparaciones por vivienda
              <br />• Visión anual y mensual de todo lo que sale de tu bolsillo
            </Typography>

            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2 }}
            >
              📈 Flujo de caja y deuda
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              paragraph
              sx={{ ml: 4 }}
            >
              • Ingresos y gastos acumulados últimos 12 meses
              <br />
              • Deuda amortizada durante el año
              <br />• Evolución del cash flow mes a mes
            </Typography>

            <Typography
              variant="h6"
              gutterBottom
              sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2 }}
            >
              📉 Rentabilidad de cada inversión
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              paragraph
              sx={{ ml: 4 }}
            >
              • Capital invertido (equity) en cada operación
              <br />
              • Cash-on-Cash Return sobre tu dinero aportado
              <br />• Cap Rate neto de cada vivienda y de toda la cartera
            </Typography>
          </Box>
        </Box>

        {/* Login / Signup Section */}
        <Card
          sx={{
            maxWidth: 400,
            width: "100%",
            flex: { xs: 1, md: "0 0 400px" },
            order: { xs: 1, md: 2 },
          }}
        >
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" component="h2" gutterBottom align="center">
              Accede a tu panel
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              paragraph
              align="center"
            >
              Gestiona tus propiedades, gastos, hipotecas y rentabilidad desde
              un único dashboard.
            </Typography>

            <Box component="form" onSubmit={onSubmit} sx={{ mt: 3 }}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Contraseña"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                margin="normal"
                required
              />

              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ mt: 3 }}
              >
                {loading ? "Iniciando sesión..." : "Entrar en mi cuenta"}
              </Button>

              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                align="center"
                sx={{ mt: 1.5 }}
              >
                Acceso gratuito durante la beta · Sin tarjeta de crédito
              </Typography>

              <Box sx={{ mt: 3, textAlign: "center" }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <Link component={RouterLink} to="/forgot-password">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </Typography>
                <Typography variant="body2">
                  ¿Aún no tienes cuenta?{" "}
                  <Link component={RouterLink} to="/signup">
                    Crear cuenta gratis
                  </Link>
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
