import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/firebase/client";
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
import { ArrowBack } from "@mui/icons-material";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      // If your domain is whitelisted in Firebase Console, uncomment the lines below
      // to redirect users back to your app after password reset
      // await sendPasswordResetEmail(auth, email, {
      //   url: window.location.origin + "/login",
      //   handleCodeInApp: false,
      // });

      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
      setEmail("");
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        setError("No existe una cuenta con este correo electrónico");
      } else if (err.code === "auth/invalid-email") {
        setError("El correo electrónico no es válido");
      } else {
        setError(err.message || "Error al enviar el correo de recuperación");
      }
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
      }}
    >
      <Card sx={{ maxWidth: 400, width: "100%", mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ mb: 3 }}>
            <Link
              component={RouterLink}
              to="/login"
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                textDecoration: "none",
                color: "primary.main",
                mb: 2,
              }}
            >
              <ArrowBack fontSize="small" />
              <Typography variant="body2">Volver al inicio de sesión</Typography>
            </Link>
          </Box>

          <Typography variant="h5" component="h1" gutterBottom>
            Recuperar Contraseña
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Ingresa tu correo electrónico y te enviaremos un enlace para
            restablecer tu contraseña.
          </Typography>

          {success ? (
            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="body2" gutterBottom>
                ¡Correo enviado!
              </Typography>
              <Typography variant="body2">
                Revisa tu bandeja de entrada y sigue las instrucciones para
                restablecer tu contraseña.
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Si no recibes el correo en unos minutos, revisa tu carpeta de spam.
              </Typography>
            </Alert>
          ) : (
            <Box component="form" onSubmit={onSubmit} sx={{ mt: 3 }}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                required
                autoFocus
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
                {loading ? "Enviando..." : "Enviar Enlace de Recuperación"}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
