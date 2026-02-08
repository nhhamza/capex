import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Alert,
  Button,
  Stack,
} from "@mui/material";
import { Loan, RecurringExpense, OneOffExpense } from "../types";
import { PropertyExpensesTab } from "./PropertyExpensesTab";
import { formatCurrency } from "@/utils/format";
import { monthlyPaymentFrancesa } from "../calculations";

interface PropertyExpensesAndLoanTabProps {
  propertyId: string;
  loan: Loan | null;
  recurring: RecurringExpense[];
  capex: OneOffExpense[];
  onSave: () => void;
}

/**
 * Consolidated tab for expenses and financing
 * Shows loan/mortgage information and all expense categories
 */
export function PropertyExpensesAndLoanTab({
  propertyId,
  loan,
  recurring,
  capex,
  onSave,
}: PropertyExpensesAndLoanTabProps) {
  return (
    <Box>
      {/* Loan/Financing Section */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            💰 Hipoteca / Financiación
          </Typography>

          {loan && loan.principal > 0 ? (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Cantidad del préstamo
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {formatCurrency(loan.principal)}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Cuota mensual
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {formatCurrency(
                      monthlyPaymentFrancesa(
                        loan.principal,
                        loan.annualRatePct,
                        loan.termMonths,
                      ) || 0,
                    )}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Tasa de interés anual
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {loan.annualRatePct || 0}%
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Plazo
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {loan.termMonths ? `${loan.termMonths} meses` : "N/A"}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    window.location.href = `/properties/${propertyId}?tab=hipoteca`;
                  }}
                >
                  Editar hipoteca
                </Button>
              </Grid>
            </Grid>
          ) : (
            <Stack spacing={2}>
              <Alert severity="info">No hay hipoteca registrada.</Alert>
              <Button
                variant="contained"
                size="small"
                onClick={() => {
                  window.location.href = `/properties/${propertyId}?tab=hipoteca`;
                }}
              >
                Añadir financiación
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Expenses Section - use existing PropertyExpensesTab */}
      <PropertyExpensesTab
        propertyId={propertyId}
        recurring={recurring}
        capex={capex}
        onSave={onSave}
      />
    </Box>
  );
}
