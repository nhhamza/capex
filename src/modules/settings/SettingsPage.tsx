import { Box, Typography, Paper, TextField, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, CircularProgress, Chip } from "@mui/material";
import { useAuth } from "@/auth/authContext";
import { useState, useEffect } from "react";
import { backendApi } from "@/lib/backendApi";
import DownloadIcon from "@mui/icons-material/Download";
import VisibilityIcon from "@mui/icons-material/Visibility";

interface Invoice {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string;
  created: number;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  periodStart: number;
  periodEnd: number;
}

export function SettingsPage() {
  const { userDoc, user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoadingInvoices(true);
    setInvoicesError(null);
    try {
      const { data } = await backendApi.get("/api/invoices");
      setInvoices(data.invoices || []);
    } catch (err: any) {
      console.error("Error fetching invoices:", err);
      setInvoicesError(err?.response?.data?.error || "Error al cargar facturas");
    } finally {
      setLoadingInvoices(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, { label: string; color: "success" | "warning" | "error" | "default" }> = {
      paid: { label: "Pagada", color: "success" },
      open: { label: "Pendiente", color: "warning" },
      void: { label: "Anulada", color: "default" },
      uncollectible: { label: "Incobrable", color: "error" },
      draft: { label: "Borrador", color: "default" },
    };
    return statusMap[status] || { label: status, color: "default" };
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Configuración
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Organización
        </Typography>
        <TextField
          fullWidth
          label="ID de Organización"
          value={userDoc?.orgId || ""}
          disabled
        />
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Usuario
        </Typography>
        <TextField
          fullWidth
          label="Nombre"
          value={user?.displayName || user?.email?.split("@")[0] || ""}
          disabled
          sx={{ mb: 2 }}
        />
        <TextField fullWidth label="Email" value={user?.email || ""} disabled />
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Información
        </Typography>
        <Alert severity="info">
          <Typography variant="body2" gutterBottom>
            <strong>Cálculos automáticos:</strong>
          </Typography>
          <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
            <li>
              <strong>Vacancia:</strong> Se calcula automáticamente según los
              períodos de los contratos de alquiler.
            </li>
            <li>
              <strong>ITP y gastos de compra:</strong> Se definen
              individualmente para cada vivienda en la pestaña "Compra".
            </li>
            <li>
              <strong>Rentabilidad:</strong> Los cálculos usan los datos reales
              de cada propiedad (contratos activos, gastos fijos, préstamos,
              etc.).
            </li>
          </ul>
        </Alert>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Facturas
        </Typography>

        {invoicesError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {invoicesError}
          </Alert>
        )}

        {loadingInvoices ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : invoices.length === 0 ? (
          <Alert severity="info">
            No hay facturas disponibles. Las facturas aparecerán aquí cuando realices tu primera compra.
          </Alert>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Número</strong></TableCell>
                  <TableCell><strong>Fecha</strong></TableCell>
                  <TableCell><strong>Período</strong></TableCell>
                  <TableCell><strong>Importe</strong></TableCell>
                  <TableCell><strong>Estado</strong></TableCell>
                  <TableCell><strong>Acciones</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((invoice) => {
                  const statusInfo = getStatusLabel(invoice.status);
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell>{invoice.number || invoice.id}</TableCell>
                      <TableCell>{formatDate(invoice.created)}</TableCell>
                      <TableCell>
                        {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
                      </TableCell>
                      <TableCell>
                        {invoice.amount.toFixed(2)} {invoice.currency.toUpperCase()}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={statusInfo.label}
                          color={statusInfo.color}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", gap: 1 }}>
                          {invoice.hostedInvoiceUrl && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<VisibilityIcon />}
                              href={invoice.hostedInvoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Ver
                            </Button>
                          )}
                          {invoice.invoicePdf && (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<DownloadIcon />}
                              href={invoice.invoicePdf}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              PDF
                            </Button>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
