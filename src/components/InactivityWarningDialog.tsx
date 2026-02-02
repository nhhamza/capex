import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress,
} from "@mui/material";
import { Warning as WarningIcon } from "@mui/icons-material";

export interface InactivityWarningDialogProps {
  open: boolean;
  secondsRemaining: number;
  onStillHere: () => void;
  onLogout: () => void;
}

export function InactivityWarningDialog({
  open,
  secondsRemaining,
  onStillHere,
  onLogout,
}: InactivityWarningDialogProps) {
  const progress = (secondsRemaining / 30) * 100;

  return (
    <Dialog
      open={open}
      onClose={onStillHere}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={false}
    >
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <WarningIcon color="warning" sx={{ fontSize: 32 }} />
          <Typography variant="h6">Sesión Inactiva</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body1" gutterBottom>
          Tu sesión está a punto de expirar por inactividad.
        </Typography>

        <Box sx={{ mt: 3, mb: 2 }}>
          <Typography variant="h4" align="center" color="warning.main">
            {secondsRemaining}s
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary">
            Cierre de sesión automático
          </Typography>
        </Box>

        <LinearProgress
          variant="determinate"
          value={progress}
          color="warning"
          sx={{ mt: 2, height: 8, borderRadius: 1 }}
        />

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Por seguridad, cerraremos tu sesión automáticamente si no detectamos actividad.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onLogout} color="inherit">
          Cerrar Sesión
        </Button>
        <Button onClick={onStillHere} variant="contained" autoFocus>
          Continuar Sesión
        </Button>
      </DialogActions>
    </Dialog>
  );
}
