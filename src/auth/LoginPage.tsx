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
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // AuthProvider will handle navigation after user doc is loaded
    } catch (err: any) {
      setError(err?.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "grey.100",
        px: 2,
        py: 4,
      }}
    >
      <Card sx={{ maxWidth: 420, width: "100%" }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
            <Chip label="Acceso a tu panel" color="primary" variant="outlined" />
          </Box>

          <Typography variant="h5" component="h1" gutterBottom align="center">
            Iniciar sesión
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center">
            Entra para gestionar tus propiedades, gastos y rentabilidad.
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
              autoComplete="email"
            />
            <TextField
              fullWidth
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              autoComplete="current-password"
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
              {loading ? "Iniciando sesión..." : "Entrar"}
            </Button>

            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              align="center"
              sx={{ mt: 1.5 }}
            >
              ¿No tienes cuenta?{" "}
              <Link component={RouterLink} to="/signup">
                Crear cuenta gratis
              </Link>
            </Typography>

            <Box sx={{ mt: 2, textAlign: "center" }}>
              <Link component={RouterLink} to="/forgot-password">
                ¿Olvidaste tu contraseña?
              </Link>
            </Box>

            <Box sx={{ mt: 3, textAlign: "center" }}>
              <Link component={RouterLink} to="/">
                ← Volver a inicio
              </Link>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
