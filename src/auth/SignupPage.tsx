import { useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { backendApi } from "@/lib/backendApi";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Link,
  Grid,
  Chip,
  Step,
  Stepper,
  StepLabel,
  Stack,
  Divider,
} from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import { GoogleLogin } from "@/components/GoogleLogin";

// Schema para Step 1 (solo email)
const step1Schema = z.object({
  email: z.string().email("Email inválido"),
});

// Schema para Step 2 (password y nombre)
const step2Schema = z
  .object({
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Debe contener mayúsculas, minúsculas y números",
      ),
    confirmPassword: z.string(),
    name: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type Step1FormData = z.infer<typeof step1Schema>;
type Step2FormData = z.infer<typeof step2Schema>;

export function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  // Step 1 form
  const step1Form = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
  });

  // Step 2 form
  const step2Form = useForm<Step2FormData>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      name: "",
    },
  });

  const onStep1Submit = async (data: Step1FormData) => {
    setError("");

    // Validar que el email no esté registrado
    try {
      setLoading(true);
      // Aquí podrías hacer una validación del backend si lo deseas
      setEmail(data.email);
      setStep(2);
    } catch (err) {
      setError("Error al validar el email");
    } finally {
      setLoading(false);
    }
  };

  const onStep2Submit = async (data: Step2FormData) => {
    setError("");
    setLoading(true);

    try {
      // Bootstrap profile + organization from backend (Admin SDK)
      await backendApi.post("/api/signup/initialize", {
        email: email,
        password: data.password,
        name: data.name || email.split("@")[0],
        orgName: data.name || email.split("@")[0],
        profile: {
          name: data.name || email.split("@")[0],
        },
      });

      // Navigate to onboarding
      navigate("/onboarding");
    } catch (err: any) {
      console.error("Signup error:", err);
      let errorMessage = "Error al crear la cuenta";

      if (err.code === "auth/email-already-in-use") {
        errorMessage = "Este email ya está registrado";
      } else if (err.code === "auth/weak-password") {
        errorMessage = "La contraseña es demasiado débil";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Email inválido";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep(1);
    setError("");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        bgcolor: "grey.100",
        py: 4,
      }}
    >
      <Card sx={{ maxWidth: 500, width: "100%", mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Chip
            label="Beta privada · Acceso gratuito"
            color="primary"
            sx={{ mb: 3 }}
          />

          {/* Stepper */}
          <Stepper activeStep={step - 1} sx={{ mb: 4 }}>
            <Step>
              <StepLabel>Email</StepLabel>
            </Step>
            <Step>
              <StepLabel>Contraseña</StepLabel>
            </Step>
          </Stepper>

          {/* STEP 1: Email */}
          {step === 1 && (
            <Box>
              <Typography variant="h5" component="h1" gutterBottom>
                Empieza gratis
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Sin tarjeta, cancela cuando quieras
              </Typography>

              {/* Google OAuth Button */}
              <Box sx={{ mb: 3 }}>
                <GoogleLogin />
              </Box>

              <Divider sx={{ my: 2.5 }}>
                <Typography variant="caption" color="text.secondary">
                  O con email
                </Typography>
              </Divider>

              <Box
                component="form"
                onSubmit={step1Form.handleSubmit(onStep1Submit)}
                sx={{ mt: 2 }}
              >
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  placeholder="tu@email.com"
                  {...step1Form.register("email")}
                  error={!!step1Form.formState.errors.email}
                  helperText={
                    step1Form.formState.errors.email?.message ||
                    "Tardarás menos de 60 segundos en empezar"
                  }
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
                  {loading ? "Validando..." : "Continuar"}
                </Button>

                {/* Benefits */}
                <Stack spacing={1} sx={{ mt: 3 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CheckCircleOutlinedIcon
                      sx={{ fontSize: 18, color: "success.main" }}
                    />
                    <Typography variant="caption">
                      Gratis hasta 1 propiedad
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CheckCircleOutlinedIcon
                      sx={{ fontSize: 18, color: "success.main" }}
                    />
                    <Typography variant="caption">
                      No requiere tarjeta
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CheckCircleOutlinedIcon
                      sx={{ fontSize: 18, color: "success.main" }}
                    />
                    <Typography variant="caption">
                      Cancela cuando quieras
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Box>
          )}

          {/* STEP 2: Password & Name */}
          {step === 2 && (
            <Box>
              <Typography variant="h5" component="h1" gutterBottom>
                Crea tu cuenta
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {email}
              </Typography>

              <Box
                component="form"
                onSubmit={step2Form.handleSubmit(onStep2Submit)}
                sx={{ mt: 3 }}
              >
                <Grid container spacing={2}>
                  {/* Contraseña */}
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Contraseña"
                      type="password"
                      {...step2Form.register("password")}
                      error={!!step2Form.formState.errors.password}
                      helperText={
                        step2Form.formState.errors.password?.message ||
                        "Mín. 8 caracteres, mayúsculas, minúsculas y números"
                      }
                      required
                      autoFocus
                    />
                  </Grid>

                  {/* Confirmar contraseña */}
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Confirmar contraseña"
                      type="password"
                      {...step2Form.register("confirmPassword")}
                      error={!!step2Form.formState.errors.confirmPassword}
                      helperText={
                        step2Form.formState.errors.confirmPassword?.message
                      }
                      required
                    />
                  </Grid>

                  {/* Nombre (opcional) */}
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="¿Cómo te llamas?"
                      {...step2Form.register("name")}
                      error={!!step2Form.formState.errors.name}
                      helperText="Opcional - para personalizar tu experiencia"
                      placeholder="Tu nombre"
                    />
                  </Grid>
                </Grid>

                {error && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                  </Alert>
                )}

                <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={handleBack}
                    disabled={loading}
                  >
                    Atrás
                  </Button>
                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={loading}
                  >
                    {loading ? "Creando..." : "Crear mi cuenta gratuita"}
                  </Button>
                </Stack>

                {/* Gift */}
                <Box
                  sx={{
                    mt: 3,
                    p: 1.5,
                    bgcolor: "info.light",
                    borderRadius: 1,
                    textAlign: "center",
                  }}
                >
                  <Typography variant="caption">
                    🎁 <strong>14 días de plan Premium de regalo</strong>
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}

          {/* Login link */}
          <Box sx={{ mt: 3, textAlign: "center" }}>
            <Typography variant="body2">
              ¿Ya tienes cuenta?{" "}
              <Link component={RouterLink} to="/login">
                Iniciar sesión
              </Link>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
