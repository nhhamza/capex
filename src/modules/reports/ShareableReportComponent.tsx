import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ShareIcon from "@mui/icons-material/Share";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { Property, Lease } from "@/modules/properties/types";
import {
  generateSummary,
  generateShareablePDF,
  copyToClipboard,
  trackReportExported,
  trackReferralShared,
  ShareReportData,
} from "./shareableReportUtils";

interface ShareableReportProps {
  properties: Property[];
  leases: Lease[];
  monthlyIncome: number;
  monthlyExpenses: number;
  avgROI: number;
}

/**
 * Component for sharing/exporting portfolio reports
 * Provides PDF export and social sharing functionality
 */
export function ShareableReport({
  properties,
  leases,
  monthlyIncome,
  monthlyExpenses,
  avgROI,
}: ShareableReportProps) {
  const [exporting, setExporting] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  const reportData: ShareReportData = {
    properties,
    leases,
    monthlyIncome,
    monthlyExpenses,
    avgROI,
  };

  const { text, whatsappUrl, linkedinUrl } = generateSummary(reportData);

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      await generateShareablePDF(reportData);
      trackReportExported("pdf");
      setSnackbar({
        open: true,
        message: "📄 PDF descargado exitosamente",
        severity: "success",
      });
    } catch (error) {
      console.error("PDF export failed:", error);
      setSnackbar({
        open: true,
        message: "Error al descargar PDF",
        severity: "error",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleShareWhatsApp = () => {
    trackReferralShared("whatsapp");
    window.open(whatsappUrl, "_blank");
  };

  const handleShareLinkedIn = () => {
    trackReferralShared("linkedin");
    window.open(linkedinUrl, "_blank");
  };

  const handleCopyToClipboard = async () => {
    const success = await copyToClipboard(text);
    trackReferralShared("clipboard");
    setSnackbar({
      open: true,
      message: success
        ? "✓ Copiado al portapapeles"
        : "Error al copiar al portapapeles",
      severity: success ? "success" : "error",
    });
  };

  return (
    <>
      <Card sx={{ bgcolor: "background.paper", border: "1px solid #e0e0e0" }}>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ fontWeight: 700, fontSize: "1rem", mb: 1 }}>
              📤 Comparte tu Portfolio
            </Box>
            <Box sx={{ fontSize: "0.9rem", color: "text.secondary" }}>
              Descarga un reporte PDF profesional o comparte tu resumen en redes
              sociales
            </Box>
          </Box>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
            }}
          >
            {/* PDF Export Button */}
            <Button
              variant="contained"
              color="primary"
              startIcon={<FileDownloadIcon />}
              onClick={handleExportPDF}
              disabled={exporting}
              sx={{ flex: { xs: "1 0 100%", sm: "auto" } }}
            >
              {exporting ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Generando...
                </>
              ) : (
                "Descargar PDF"
              )}
            </Button>

            {/* WhatsApp Share Button */}
            <Button
              variant="outlined"
              startIcon={<ShareIcon />}
              onClick={handleShareWhatsApp}
              sx={{
                flex: { xs: "1 0 100%", sm: "auto" },
                borderColor: "#25D366",
                color: "#25D366",
                "&:hover": {
                  borderColor: "#20ba5a",
                  backgroundColor: "rgba(37, 211, 102, 0.04)",
                },
              }}
            >
              WhatsApp
            </Button>

            {/* LinkedIn Share Button */}
            <Button
              variant="outlined"
              startIcon={<ShareIcon />}
              onClick={handleShareLinkedIn}
              sx={{
                flex: { xs: "1 0 100%", sm: "auto" },
                borderColor: "#0A66C2",
                color: "#0A66C2",
                "&:hover": {
                  borderColor: "#085195",
                  backgroundColor: "rgba(10, 102, 194, 0.04)",
                },
              }}
            >
              LinkedIn
            </Button>

            {/* Copy to Clipboard Button */}
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopyToClipboard}
              sx={{
                flex: { xs: "1 0 100%", sm: "auto" },
              }}
            >
              Copiar Texto
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Alert severity={snackbar.severity} sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
