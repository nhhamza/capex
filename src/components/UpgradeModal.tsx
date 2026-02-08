import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useNavigate } from "react-router-dom";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  currentPlan: string;
  suggestedPlan: "solo" | "pro" | null;
  currentPropertyCount: number;
}

const PLAN_INFO = {
  solo: {
    name: "Solo",
    price: 4.99,
    limit: 5,
    features: [
      "Hasta 5 propiedades",
      "Exportación ilimitada",
      "Métricas avanzadas",
      "Soporte prioritario",
    ],
  },
  pro: {
    name: "Pro",
    price: 9.99,
    limit: 20,
    features: [
      "Hasta 20 propiedades",
      "Todo de Solo +",
      "Reportes personalizados",
      "API access",
    ],
  },
};

export function UpgradeModal({
  open,
  onClose,
  currentPlan,
  suggestedPlan,
  currentPropertyCount,
}: UpgradeModalProps) {
  const navigate = useNavigate();

  if (!suggestedPlan) {
    return null;
  }

  const plan = PLAN_INFO[suggestedPlan];

  const handleUpgrade = () => {
    navigate("/billing");
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogContent sx={{ pt: 4 }}>
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            🎉 ¡Tu portfolio está creciendo!
          </Typography>
          <Typography color="text.secondary">
            Tienes {currentPropertyCount}{" "}
            {currentPropertyCount === 1 ? "propiedad" : "propiedades"}. Para
            añadir más, actualiza a plan {plan.name}:
          </Typography>
        </Box>

        <Box
          sx={{
            my: 3,
            p: 3,
            bgcolor: "success.light",
            borderRadius: 2,
            textAlign: "center",
          }}
        >
          <Typography variant="overline" color="text.secondary">
            {plan.name}
          </Typography>
          <Typography variant="h3" fontWeight={900}>
            €{plan.price}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            al mes
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: "block" }}
          >
            = €{(plan.price / plan.limit).toFixed(2)} por propiedad/mes
          </Typography>
        </Box>

        <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
          Incluye:
        </Typography>
        <List dense>
          {plan.features.map((feature, idx) => (
            <ListItem key={idx}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <CheckCircleIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={feature} />
            </ListItem>
          ))}
        </List>

        <Box sx={{ mt: 2, p: 2, bgcolor: "info.light", borderRadius: 1 }}>
          <Typography variant="body2" align="center">
            🎁 <strong>14 días de prueba gratis</strong> + cancela cuando
            quieras
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Continuar con plan {currentPlan}
        </Button>
        <Button onClick={handleUpgrade} variant="contained" size="large">
          Actualizar ahora
        </Button>
      </DialogActions>
    </Dialog>
  );
}
