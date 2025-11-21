import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Box,
  Grid,
  TextField,
  Button,
  Typography,
  Divider,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { Property, AcquisitionCosts } from "../types";
import { updateProperty } from "../api";
import { parseDate, toISOString } from "@/utils/date";
import { Money } from "@/components/Money";

const schema = z.object({
  address: z.string().min(1, "Dirección requerida"),
  city: z.string().optional(),
  zip: z.string().optional(),
  purchasePrice: z.number().min(1, "Precio requerido"),
  purchaseDate: z.any().optional(),
  currentValue: z.number().optional(),
  itp: z.number().optional(),
  notary: z.number().optional(),
  registry: z.number().optional(),
  ajd: z.number().optional(),
  initialRenovation: z.number().optional(),
  appliances: z.number().optional(),
  others: z.number().optional(),
});

type FormData = z.infer<typeof schema>;

interface PropertyPurchaseTabProps {
  property: Property;
  onSave: () => void;
}

export function PropertyPurchaseTab({
  property,
  onSave,
}: PropertyPurchaseTabProps) {
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    register,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      address: property.address,
      city: property.city || "",
      zip: property.zip || "",
      purchasePrice: property.purchasePrice,
      purchaseDate: parseDate(property.purchaseDate),
      currentValue: property.currentValue || property.purchasePrice,
      itp: property.closingCosts?.itp || 0,
      notary: property.closingCosts?.notary || 0,
      registry: property.closingCosts?.registry || 0,
      ajd: property.closingCosts?.ajd || 0,
      initialRenovation: property.closingCosts?.initialRenovation || 0,
      appliances: property.closingCosts?.appliances || 0,
      others: property.closingCosts?.others || 0,
    },
  });

  // Watch closing costs for live total
  const watchedCosts = watch([
    "itp",
    "notary",
    "registry",
    "ajd",
    "initialRenovation",
    "appliances",
    "others",
  ]);

  const closingCostsTotal: number = watchedCosts.reduce<number>(
    (acc, val) => acc + (val || 0),
    0
  );
  const watchedPrice = watch("purchasePrice");
  const totalInvestment = watchedPrice + closingCostsTotal;

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const closingCosts: AcquisitionCosts = {
        itp: data.itp,
        notary: data.notary,
        registry: data.registry,
        ajd: data.ajd,
        initialRenovation: data.initialRenovation,
        appliances: data.appliances,
        others: data.others,
      };

      await updateProperty(property.id, {
        address: data.address,
        city: data.city,
        zip: data.zip,
        purchasePrice: data.purchasePrice,
        purchaseDate: toISOString(data.purchaseDate),
        currentValue: data.currentValue,
        closingCosts,
      });

      onSave();
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Typography variant="h6" gutterBottom>
          Datos Generales
        </Typography>

        <Grid container spacing={{ xs: 3, sm: 4 }} sx={{ mb: 4 }}>
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
            <TextField
              fullWidth
              label="Valor Actual"
              type="number"
              {...register("currentValue", { valueAsNumber: true })}
              helperText="Estimación valor mercado para ratio endeudamiento"
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
                  slotProps={{ textField: { fullWidth: true, size: "medium" } }}
                />
              )}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 4 }} />

        <Typography variant="h6" gutterBottom>
          Gastos de Adquisición
        </Typography>

        <Grid container spacing={{ xs: 3, sm: 4 }} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="ITP"
              type="number"
              {...register("itp", { valueAsNumber: true })}
              size="medium"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Notaría"
              type="number"
              {...register("notary", { valueAsNumber: true })}
              size="medium"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Registro"
              type="number"
              {...register("registry", { valueAsNumber: true })}
              size="medium"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="AJD"
              type="number"
              {...register("ajd", { valueAsNumber: true })}
              size="medium"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Reforma Inicial"
              size="medium"
              type="number"
              {...register("initialRenovation", { valueAsNumber: true })}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Electrodomésticos"
              type="number"
              {...register("appliances", { valueAsNumber: true })}
              size="medium"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Otros Gastos"
              type="number"
              {...register("others", { valueAsNumber: true })}
              size="medium"
            />
          </Grid>
        </Grid>

        <Box sx={{ bgcolor: "grey.100", p: { xs: 2, sm: 3 }, borderRadius: 1, mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                Precio de compra:
              </Typography>
              <Typography variant="h6">
                <Money amount={watchedPrice} />
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="body2" color="text.secondary">
                Gastos de adquisición:
              </Typography>
              <Typography variant="h6">
                <Money amount={closingCostsTotal} />
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Inversión Total:
              </Typography>
              <Typography variant="h5" color="primary">
                <Money amount={totalInvestment} />
              </Typography>
            </Grid>
          </Grid>
        </Box>

        <Button 
          type="submit" 
          variant="contained" 
          disabled={loading}
          size="large"
          sx={{ minHeight: 48 }}
        >
          {loading ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </form>
    </Box>
  );
}
