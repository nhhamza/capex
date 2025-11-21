import { Box, Typography, Paper, TextField, Alert } from "@mui/material";
import { useAuth } from "@/auth/authContext";

export function SettingsPage() {
  const { userDoc, user } = useAuth();

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

      <Paper sx={{ p: 3 }}>
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
    </Box>
  );
}
