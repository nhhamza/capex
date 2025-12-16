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
    phone: z
      .string()
      .regex(/^[+]?[0-9]{9,15}$/, "Teléfono inválido (9-15 dígitos)")
      .optional()
      .or(z.literal("")),
    city: z.string().min(2, "La ciudad es requerida"),
    userType: z.enum(["investor", "small_owner"], {
      required_error: "Selecciona tu perfil",
    }),
    companyName: z.string().optional(),
    propertyCount: z.enum(["0", "1-3", "4-10", "11-20", "21+"]),
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

export function SignupPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      userType: undefined,
      propertyCount: "0",
      acceptTerms: false,
      acceptPrivacy: false,
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    setError("");
    setLoading(true);

    try {
      // Bootstrap profile + organization from backend (Admin SDK)
      await backendApi.post("/api/bootstrap", {
        orgName: data.companyName || data.name,
        profile: {
          name: data.name,
          phone: data.phone || null,
          city: data.city,
          userType: data.userType,
          companyName: data.companyName || null,
          propertyCount: data.propertyCount,
        },
      });

      // Navigate to dashboard
      navigate("/dashboard");
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
            Únete a la plataforma de gestión inmobiliaria para inversores y
            propietarios en España.
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

              {/* User Type */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label="¿Cuál es tu perfil?"
                  {...register("userType")}
                  error={!!errors.userType}
                  helperText={errors.userType?.message}
                  required
                >
                  <MenuItem value="investor">
                    Inversor (múltiples propiedades)
                  </MenuItem>
                  <MenuItem value="small_owner">
                    Pequeño propietario (1-3 propiedades)
                  </MenuItem>
                </TextField>
              </Grid>

              {/* Property Count */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label="¿Cuántas propiedades gestionas?"
                  {...register("propertyCount")}
                  error={!!errors.propertyCount}
                  helperText={errors.propertyCount?.message}
                  required
                >
                  <MenuItem value="0">Ninguna (empezando)</MenuItem>
                  <MenuItem value="1-3">1-3 propiedades</MenuItem>
                  <MenuItem value="4-10">4-10 propiedades</MenuItem>
                  <MenuItem value="11-20">11-20 propiedades</MenuItem>
                  <MenuItem value="21+">21 o más propiedades</MenuItem>
                </TextField>
              </Grid>

              {/* Company Name */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nombre de empresa (opcional)"
                  {...register("companyName")}
                  error={!!errors.companyName}
                  helperText="Si gestionas propiedades a través de una empresa"
                />
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
