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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { Loan } from "../types";
import { createLoan, updateLoan } from "../api";
import { Lease } from "../types";
import { parseDate, toISOString } from "@/utils/date";
import { buildAmortizationSchedule } from "../calculations";
import { Money } from "@/components/Money";

const schema = z.object({
  principal: z.number().min(1, "Principal requerido"),
  annualRatePct: z.number().min(0, "Tasa requerida"),
  termMonths: z.number().min(1, "Plazo requerido"),
  startDate: z.any().optional(),
  interestOnlyMonths: z.number().min(0).optional(),
  upFrontFees: z.number().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface PropertyLoanTabProps {
  propertyId: string;
  loan: Loan | null;
  lease?: Lease | null; // to inform if property purchased but not leased
  onSave: () => void;
}

export function PropertyLoanTab({
  propertyId,
  loan,
  lease: _lease,
  onSave,
}: PropertyLoanTabProps) {
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
      principal: loan?.principal || 0,
      annualRatePct: loan?.annualRatePct || 3.5,
      termMonths: loan?.termMonths || 300,
      startDate: parseDate(loan?.startDate),
      interestOnlyMonths: loan?.interestOnlyMonths || 0,
      upFrontFees: loan?.upFrontFees || 0,
      notes: loan?.notes || "",
    },
  });

  const watchedPrincipal = watch("principal");
  const watchedRate = watch("annualRatePct");
  const watchedTerm = watch("termMonths");
  const watchedInterestOnly = watch("interestOnlyMonths") || 0;

  // Build preview schedule
  const schedule =
    watchedPrincipal > 0 && watchedRate > 0 && watchedTerm > 0
      ? buildAmortizationSchedule({
          principal: watchedPrincipal,
          annualRatePct: watchedRate,
          termMonths: watchedTerm,
          interestOnlyMonths: watchedInterestOnly,
        })
      : null;

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const loanData = {
        propertyId,
        principal: data.principal,
        annualRatePct: data.annualRatePct,
        termMonths: data.termMonths,
        startDate: toISOString(data.startDate),
        interestOnlyMonths: data.interestOnlyMonths,
        upFrontFees: data.upFrontFees,
        notes: data.notes,
      };

      if (loan) {
        await updateLoan(loan.id, loanData);
      } else {
        await createLoan(loanData);
      }

      onSave();
    } catch (error) {
      console.error("Error saving loan:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Typography variant="h6" gutterBottom>
          Financiación
        </Typography>

        {!loan && (
          <Alert severity="info" sx={{ mb: 2 }}>
            No has registrado un préstamo todavía. Si la compra fue al contado
            puedes dejar este apartado vacío; en caso contrario completa los
            datos y guarda para ver métricas apalancadas (ADS, DSCR, LTV).
          </Alert>
        )}
        {loan && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Préstamo guardado. Puedes ajustar condiciones o añadir notas.
          </Alert>
        )}

        <Grid container spacing={{ xs: 3, sm: 4 }} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Principal"
              type="number"
              {...register("principal", { valueAsNumber: true })}
              error={!!errors.principal}
              helperText={errors.principal?.message}
              size="medium"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Tasa Anual (%)"
              type="number"
              {...register("annualRatePct", { valueAsNumber: true })}
              error={!!errors.annualRatePct}
              helperText={errors.annualRatePct?.message}
              inputProps={{ step: 0.01 }}
              size="medium"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Plazo (meses)"
              type="number"
              {...register("termMonths", { valueAsNumber: true })}
              error={!!errors.termMonths}
              helperText={errors.termMonths?.message}
              size="medium"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <Controller
              name="startDate"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label="Fecha de Inicio"
                  value={field.value}
                  onChange={field.onChange}
                  slotProps={{ textField: { fullWidth: true, size: "medium" } }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Meses Carencia"
              type="number"
              {...register("interestOnlyMonths", { valueAsNumber: true })}
              helperText="Periodo solo intereses"
              size="medium"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Gastos de Apertura"
              type="number"
              {...register("upFrontFees", { valueAsNumber: true })}
              size="medium"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Notas"
              size="medium"
              multiline
              rows={2}
              {...register("notes")}
            />
          </Grid>

          <Grid item xs={12}>
            <Button 
              type="submit" 
              variant="contained" 
              disabled={loading}
              size="large"
              sx={{ minHeight: 48 }}
            >
              {loading ? "Guardando..." : "Guardar Financiación"}
            </Button>
          </Grid>
        </Grid>
      </form>

      {schedule && (
        <>
          <Typography variant="h6" gutterBottom sx={{ mt: 4 }}>
            Cuadro de Amortización (Primeros 12 meses)
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Cuota mensual: <Money amount={schedule.payment} />
          </Typography>

          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Mes</TableCell>
                  <TableCell align="right">Cuota</TableCell>
                  <TableCell align="right">Intereses</TableCell>
                  <TableCell align="right">Amortización</TableCell>
                  <TableCell align="right">Pendiente</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {schedule.schedule.slice(0, 12).map((row) => (
                  <TableRow key={row.month}>
                    <TableCell>{row.month}</TableCell>
                    <TableCell align="right">
                      <Money amount={row.payment} />
                    </TableCell>
                    <TableCell align="right">
                      <Money amount={row.interest} />
                    </TableCell>
                    <TableCell align="right">
                      <Money amount={row.principalPaid} />
                    </TableCell>
                    <TableCell align="right">
                      <Money amount={row.balance} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
