import { Card, CardContent, Typography, Grid, Box } from "@mui/material";
import { formatCurrency } from "@/utils/format";

interface PortfolioSummaryProps {
  totalCashflow: number;
  avgROI: number;
  totalEquity: number;
  propertyCount: number;
}

/**
 * Portfolio summary header card showing key metrics at a glance
 */
export function PortfolioSummary({
  totalCashflow,
  avgROI,
  totalEquity,
  propertyCount,
}: PortfolioSummaryProps) {
  return (
    <Card
      sx={{
        mb: 3,
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white",
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
        <Typography variant="h5" fontWeight={900} gutterBottom>
          Tu Portfolio
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={6} sm={3}>
            <Box sx={{ wordBreak: "break-word", minWidth: 0 }}>
              <Typography
                variant="h3"
                fontWeight={900}
                sx={{
                  fontSize: { xs: "1.4rem", sm: "2rem", md: "3rem" },
                  wordBreak: "break-word",
                }}
              >
                {propertyCount}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Propiedades
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={6} sm={3}>
            <Box sx={{ wordBreak: "break-word", minWidth: 0 }}>
              <Typography
                variant="h3"
                fontWeight={900}
                sx={{
                  color: totalCashflow >= 0 ? "#c8e6c9" : "#ffcdd2",
                  fontSize: { xs: "1.4rem", sm: "2rem", md: "3rem" },
                  wordBreak: "break-word",
                }}
              >
                {totalCashflow >= 0 ? "+" : ""}
                {formatCurrency(totalCashflow)}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Cashflow total/mes
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={6} sm={3}>
            <Box sx={{ wordBreak: "break-word", minWidth: 0 }}>
              <Typography
                variant="h3"
                fontWeight={900}
                sx={{
                  fontSize: { xs: "1.4rem", sm: "2rem", md: "3rem" },
                  wordBreak: "break-word",
                }}
              >
                {avgROI.toFixed(1)}%
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                ROI promedio
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={6} sm={3}>
            <Box sx={{ wordBreak: "break-word", minWidth: 0 }}>
              <Typography
                variant="h3"
                fontWeight={900}
                sx={{
                  fontSize: { xs: "1.4rem", sm: "2rem", md: "3rem" },
                  wordBreak: "break-word",
                }}
              >
                {formatCurrency(totalEquity)}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Equity total
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
