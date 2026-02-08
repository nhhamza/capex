import { useState, useEffect } from "react";
import { useAuth } from "@/auth/authContext";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Stack,
  Grid,
  Alert,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Snackbar,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

interface Referral {
  id: string;
  email: string;
  signupDate: string;
  hasUpgraded: boolean;
}

export function ReferralPage() {
  const { userDoc } = useAuth();
  const [referralCode, setReferralCode] = useState("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [monthsEarned, setMonthsEarned] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReferralData();
  }, [userDoc?.id]);

  const loadReferralData = async () => {
    try {
      // TODO: Implementar llamada a API para obtener datos de referidos
      // await getReferrals(userDoc.id);

      // Por ahora, usar código fake
      const code = userDoc?.uid?.substring(0, 8).toUpperCase() || "DEMO1234";
      setReferralCode(code);

      // Datos de ejemplo
      setReferrals([]);
      setMonthsEarned(0);
    } finally {
      setLoading(false);
    }
  };

  const referralLink = `${window.location.origin}/signup?ref=${referralCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOnWhatsApp = () => {
    const text = `¡Prueba PropietarioPlus para gestionar tus alquileres! Es gratis y muy fácil: ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  const shareOnTwitter = () => {
    const text = `Gestiono mis propiedades de alquiler con @PropietarioPlus - súper fácil y gratis`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(referralLink)}`,
    );
  };

  const shareOnLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`,
    );
  };

  const pendingReferrals = referrals.filter((r) => !r.hasUpgraded).length;

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", px: 2, py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom fontWeight={900}>
          Invita y gana 1 mes gratis
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Por cada amigo que se una a plan Solo o Pro, tú ganas 1 mes gratis
        </Typography>
      </Box>

      {/* Referral Link Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight={700}>
            Tu link único
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <TextField
              fullWidth
              value={referralLink}
              InputProps={{ readOnly: true }}
              size="small"
            />
            <Button
              variant="contained"
              onClick={handleCopyLink}
              startIcon={<ContentCopyIcon />}
              sx={{ whiteSpace: "nowrap" }}
            >
              Copiar
            </Button>
          </Stack>

          <Typography variant="caption" color="text.secondary">
            Comparte este link con tus amigos propietarios
          </Typography>
        </CardContent>
      </Card>

      {/* Share Buttons */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight={700}>
            Compartir en redes
          </Typography>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Button fullWidth variant="outlined" onClick={shareOnWhatsApp}>
                💬 WhatsApp
              </Button>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Button fullWidth variant="outlined" onClick={shareOnTwitter}>
                𝕏 Twitter
              </Button>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Button fullWidth variant="outlined" onClick={shareOnLinkedIn}>
                💼 LinkedIn
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Referrals Stats */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom fontWeight={700}>
            Tus referidos ({referrals.length})
          </Typography>

          {referrals.length === 0 ? (
            <Alert severity="info">
              Aún no has referido a nadie. ¡Empieza a compartir tu link!
            </Alert>
          ) : (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Meses gratis ganados: <strong>{monthsEarned}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Pendientes de upgrade: <strong>{pendingReferrals}</strong>
                </Typography>
              </Box>

              <List>
                {referrals.map((ref) => (
                  <ListItem key={ref.id} divider>
                    <ListItemText
                      primary={ref.email}
                      secondary={
                        ref.hasUpgraded
                          ? "✅ Upgrade completado - +1 mes gratis"
                          : "⏳ Pendiente de upgrade"
                      }
                    />
                    <Typography variant="caption" color="text.secondary">
                      {new Date(ref.signupDate).toLocaleDateString("es-ES")}
                    </Typography>
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </CardContent>
      </Card>

      {/* Snackbar for copy feedback */}
      <Snackbar
        open={copied}
        autoHideDuration={2000}
        message="¡Link copiado al portapapeles!"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
