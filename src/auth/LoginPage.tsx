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
        {/* Features Section */}
        <Box sx={{
          flex: 1,
          order: { xs: 2, md: 1 },
          width: "100%"
        }}>
          <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
            Gestión Inmobiliaria
          </Typography>
          <Typography variant="h6" color="primary" gutterBottom sx={{ mb: 3 }}>
            Rentabilidad de inversiones en España
          </Typography>

          <Typography variant="body1" paragraph>
            El dashboard ofrece una visión consolidada de toda tu cartera inmobiliaria
            con métricas en tiempo real sobre ingresos, gastos, rentabilidad y deuda.
          </Typography>

          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              📊 Resumen General
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph sx={{ ml: 4 }}>
              • Número total de viviendas en gestión<br />
              • Ingresos anuales totales procedentes de los alquileres<br />
              • Cash Flow anual (beneficio neto después de gastos e hipoteca)<br />
              • Ratio de endeudamiento sobre el total de la inversión
            </Typography>

            <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2 }}>
              💸 Gastos Anuales
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph sx={{ ml: 4 }}>
              • Gastos totales anuales<br />
              • Gastos fijos (IBI, comunidad, seguros…)<br />
              • Gastos de mantenimiento y reparaciones
            </Typography>

            <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2 }}>
              📈 Flujo de Caja Consolidado
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph sx={{ ml: 4 }}>
              • Ingresos totales acumulados (últimos 12 meses)<br />
              • Gastos totales acumulados<br />
              • Deuda pagada durante el año
            </Typography>

            <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2 }}>
              📉 Rentabilidad de la Cartera
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph sx={{ ml: 4 }}>
              • Capital invertido total (equity)<br />
              • Cash-on-Cash Return (% sobre el dinero aportado)<br />
              • Cap Rate neto (% de rentabilidad sin deuda)
            </Typography>
          </Box>
        </Box>

        {/* Login Form Section */}
        <Card sx={{
          maxWidth: 400,
          width: "100%",
          flex: { xs: 1, md: "0 0 400px" },
          order: { xs: 1, md: 2 }
        }}>
          <CardContent sx={{ p: 4 }}>
            <Typography variant="h5" component="h1" gutterBottom align="center">
              Iniciar Sesión
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              paragraph
              align="center"
            >
              Accede a tu dashboard inmobiliario
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
                {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
              </Button>

              <Box sx={{ mt: 2, textAlign: "center" }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <Link component={RouterLink} to="/forgot-password">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </Typography>
                <Typography variant="body2">
                  ¿No tienes cuenta?{" "}
                  <Link component={RouterLink} to="/signup">
                    Crear cuenta
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
