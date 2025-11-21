import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { useAuth } from "@/auth/authContext";
import { useOrgLimits } from "@/hooks/useOrgLimits";
import { createProperty, getProperties } from "../api";
import { toISOString } from "@/utils/date";
import dayjs from "dayjs";

const schema = z.object({
  address: z.string().min(1, "La dirección es requerida"),
  city: z.string().optional(),
  zip: z.string().optional(),
  purchasePrice: z.number().min(1, "El precio debe ser mayor a 0"),
  purchaseDate: z.any().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function PropertyCreate() {
  const navigate = useNavigate();
  const { userDoc } = useAuth();
  const {
    loading: limitsLoading,
    plan,
    propertyLimit,
  } = useOrgLimits(userDoc?.orgId);
  const [loading, setLoading] = useState(false);
  const [propertyCount, setPropertyCount] = useState(0);
  const [checkingLimit, setCheckingLimit] = useState(true);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "error" as "error",
  });

  const hasReachedLimit = !limitsLoading && propertyCount >= propertyLimit;

  useEffect(() => {
    const checkPropertyLimit = async () => {
      if (!userDoc?.orgId) return;

      setCheckingLimit(true);
      try {
        const properties = await getProperties(userDoc.orgId);
        setPropertyCount(properties.length);
      } catch (error) {
        console.error("Error checking property limit:", error);
      } finally {
        setCheckingLimit(false);
      }
    };

    checkPropertyLimit();
  }, [userDoc?.orgId]);

  const {
    control,
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      address: "",
      city: "",
      zip: "",
      purchasePrice: 0,
      purchaseDate: dayjs(),
      notes: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!userDoc?.orgId) {
      console.error(
        "[PropertyCreate] Missing orgId in userDoc; cannot create property"
      );
      setSnackbar({
        open: true,
        message: "Organización no encontrada",
        severity: "error",
      });
      return;
    }

    if (hasReachedLimit) {
      setSnackbar({
        open: true,
        message:
          "Has alcanzado el límite de 1 vivienda en el plan Free. Mejora tu plan para agregar más.",
        severity: "error",
      });
      return;
    }

    setLoading(true);
    try {
      const property = await createProperty({
        ...data,
        organizationId: userDoc.orgId,
        purchaseDate: toISOString(data.purchaseDate),
      });
      navigate(`/properties/${property.id}`);
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Error al crear vivienda",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Nueva Vivienda
      </Typography>

      {checkingLimit || limitsLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : hasReachedLimit ? (
        <Paper sx={{ p: { xs: 2, sm: 3 }, mt: 3 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body1" gutterBottom>
              <strong>Límite alcanzado:</strong> Has alcanzado el límite de{" "}
              {propertyLimit} vivienda(s) para tu plan {plan}.
            </Typography>
            <Typography variant="body2">
              Tienes actualmente {propertyCount} vivienda(s). Mejora tu plan
              para agregar más.
            </Typography>
          </Alert>
          <Button
            variant="outlined"
            onClick={() => navigate("/properties")}
            size="large"
            sx={{ minHeight: 48 }}
          >
            Volver a Viviendas
          </Button>
        </Paper>
      ) : (
        <Paper sx={{ p: { xs: 2, sm: 3 }, mt: 3 }}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={{ xs: 3, sm: 4 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Dirección"
                  {...register("address")}
                  error={!!errors.address}
                  helperText={errors.address?.message}
                  size="medium"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Ciudad"
                  {...register("city")}
                  size="medium"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Código Postal"
                  {...register("zip")}
                  size="medium"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Precio de Compra"
                  type="number"
                  {...register("purchasePrice", { valueAsNumber: true })}
                  error={!!errors.purchasePrice}
                  helperText={errors.purchasePrice?.message}
                  size="medium"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <Controller
                  name="purchaseDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      label="Fecha de Compra"
                      value={field.value}
                      onChange={field.onChange}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: "medium",
                        },
                      }}
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Notas"
                  multiline
                  rows={4}
                  {...register("notes")}
                  size="medium"
                />
              </Grid>

              <Grid item xs={12}>
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    gap: 2,
                  }}
                >
                  <Button
                    variant="contained"
                    type="submit"
                    disabled={loading}
                    size="large"
                    fullWidth={true}
                    sx={{ minHeight: 48 }}
                  >
                    {loading ? "Guardando..." : "Crear Vivienda"}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => navigate("/properties")}
                    size="large"
                    fullWidth={true}
                    sx={{ minHeight: 48 }}
                  >
                    Cancelar
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </Paper>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
