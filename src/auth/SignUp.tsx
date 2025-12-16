import { useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase/client";
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
  MenuItem,
  FormControlLabel,
  Checkbox,
  Chip,
} from "@mui/material";

const signupSchema = z
  .object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    email: z.string().email("Email inválido"),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Debe contener mayúsculas, minúsculas y números"
      ),
    confirmPassword: z.string(),
    city: z.string().min(2, "La ciudad es requerida"),
    phone: z
      .string()
      .regex(/^[+]?[0-9]{9,15}$/, "Teléfono inválido (9-15 dígitos)")
      .optional()
      .or(z.literal("")),
    userType: z.enum(["investor", "small_owner"], {
      required_error: "Selecciona tu perfil",
    }),
    orgName: z.string().min(2, "El nombre de la organización es requerido"),
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: "Debes aceptar los términos y condiciones",
    }),
    acceptPrivacy: z.boolean().refine((val) => val === true, {
      message: "Debes aceptar la política de privacidad",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignUp() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      acceptTerms: false,
      acceptPrivacy: false,
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    setError("");
    setLoading(true);

    try {
      await createUserWithEmailAndPassword(auth, data.email, data.password);
      await backendApi.post("/api/bootstrap", {
        orgName: data.orgName,
        profile: {
          name: data.name,
          city: data.city,
          phone: data.phone || null,
          userType: data.userType,
        },
      });

      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Error al crear cuenta");
    } finally {
      setLoading(false);
    }
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
      <Card sx={{ maxWidth: 600, width: "100%", mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Chip
            label="Beta privada · Acceso gratuito"
            color="primary"
            sx={{ mb: 2 }}
          />
          <Typography variant="h5" component="h1" gutterBottom>
            Crear cuenta gratis
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Sube tus gastos y te genero automáticamente el resumen listo para
            Hacienda
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Gestiona tu cartera inmobiliaria desde un único dashboard
          </Typography>

          <Box
            component="form"
            onSubmit={handleSubmit(onSubmit)}
            sx={{ mt: 3 }}
          >
            <Grid container spacing={2}>
              {/* Name */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nombre completo"
                  {...register("name")}
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  required
                />
              </Grid>

              {/* Email */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  {...register("email")}
                  error={!!errors.email}
                  helperText={errors.email?.message}
                  required
                />
              </Grid>

              {/* Password */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Contraseña"
                  type="password"
                  {...register("password")}
                  error={!!errors.password}
                  helperText={
                    errors.password?.message ||
                    "Mín. 8 caracteres, mayúsculas, minúsculas y números"
                  }
                  required
                />
              </Grid>

              {/* Confirm Password */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Confirmar contraseña"
                  type="password"
                  {...register("confirmPassword")}
                  error={!!errors.confirmPassword}
                  helperText={errors.confirmPassword?.message}
                  required
                />
              </Grid>

              {/* City */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Ciudad"
                  {...register("city")}
                  error={!!errors.city}
                  helperText={errors.city?.message}
                  required
                />
              </Grid>

              {/* Phone */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Teléfono (opcional)"
                  {...register("phone")}
                  error={!!errors.phone}
                  helperText={errors.phone?.message || "Formato: +34612345678"}
                  placeholder="+34612345678"
                />
              </Grid>

              {/* Organization Name */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Nombre de la Organización"
                  {...register("orgName")}
                  error={!!errors.orgName}
                  helperText={
                    errors.orgName?.message || "Ej: Mi Cartera Inmobiliaria"
                  }
                  required
                />
              </Grid>

              {/* User Type */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="¿Cuál es tu perfil?"
                  {...register("userType")}
                  error={!!errors.userType}
                  helperText={errors.userType?.message}
                  required
                  defaultValue=""
                >
                  <MenuItem value="investor">
                    Inversor (múltiples propiedades)
                  </MenuItem>
                  <MenuItem value="small_owner">
                    Pequeño propietario (1-3 propiedades)
                  </MenuItem>
                </TextField>
              </Grid>

              {/* Terms and Privacy */}
              <Grid item xs={12}>
                <FormControlLabel
                  control={<Checkbox {...register("acceptTerms")} />}
                  label={
                    <Typography variant="body2">
                      Acepto los{" "}
                      <Link href="/terms" target="_blank">
                        términos y condiciones
                      </Link>
                    </Typography>
                  }
                />
                {errors.acceptTerms && (
                  <Typography variant="caption" color="error" display="block">
                    {errors.acceptTerms.message}
                  </Typography>
                )}
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={<Checkbox {...register("acceptPrivacy")} />}
                  label={
                    <Typography variant="body2">
                      Acepto la{" "}
                      <Link href="/privacy" target="_blank">
                        política de privacidad
                      </Link>
                    </Typography>
                  }
                />
                {errors.acceptPrivacy && (
                  <Typography variant="caption" color="error" display="block">
                    {errors.acceptPrivacy.message}
                  </Typography>
                )}
              </Grid>
            </Grid>

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
              {loading ? "Creando cuenta..." : "Crear cuenta gratis"}
            </Button>

            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              align="center"
              sx={{ mt: 2 }}
            >
              Durante la beta, tu cuenta es completamente gratuita. No necesitas
              tarjeta de crédito.
            </Typography>

            <Box sx={{ mt: 3, textAlign: "center" }}>
              <Typography variant="body2">
                ¿Ya tienes cuenta?{" "}
                <Link component={RouterLink} to="/login">
                  Iniciar sesión
                </Link>
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
