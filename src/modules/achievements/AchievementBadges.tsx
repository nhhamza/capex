import {
  Box,
  Chip,
  Grid,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { useState } from "react";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import { useOrgBilling } from "@/hooks/useOrgBilling";

export interface Achievement {
  id: "first_property" | "profitable_year" | "portfolio_5";
  unlocked: boolean;
  label: string;
  description: string;
  icon: string; // emoji
  requiresPlan?: "pro" | "business";
}

interface AchievementBadgesProps {
  properties: Array<{ id: string }>;
  ytdCashflow: number;
  loading?: boolean;
}

/**
 * Renders a grid of achievement badges for the dashboard
 * Shows progress toward unlocking achievements with CTAs for upgrades
 */
export function AchievementBadges({
  properties,
  ytdCashflow,
  loading = false,
}: AchievementBadgesProps) {
  const { billing } = useOrgBilling();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedAchievement, setSelectedAchievement] =
    useState<Achievement | null>(null);

  const plan = billing?.plan || "free";

  // Compute achievements
  const achievements: Achievement[] = [
    {
      id: "first_property",
      unlocked: properties.length >= 1,
      label: "Primera Propiedad",
      description: "Añade tu primera propiedad al portfolio",
      icon: "🏠",
    },
    {
      id: "profitable_year",
      unlocked: ytdCashflow > 0,
      label: "Año Rentable",
      description: `Logra un cashflow positivo este año (Actual: €${ytdCashflow.toLocaleString("es-ES")})`,
      icon: "📈",
    },
    {
      id: "portfolio_5",
      unlocked: properties.length >= 5,
      label: "Portafolio Pro",
      description: `Gestiona 5+ propiedades (Actual: ${properties.length}${properties.length === 0 ? "" : ""})`,
      icon: "👑",
      requiresPlan: "pro" as const,
    },
  ];

  const handleAchievementClick = (achievement: Achievement) => {
    if (
      achievement.id === "portfolio_5" &&
      plan === "free" &&
      !achievement.unlocked
    ) {
      setSelectedAchievement(achievement);
      setUpgradeDialogOpen(true);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <EmojiEventsIcon sx={{ mr: 1, color: "#ff9800", fontSize: 24 }} />
          <Box sx={{ fontWeight: 700, fontSize: "1rem" }}>Logros & Hitos</Box>
        </Box>

        <Grid container spacing={2}>
          {achievements.map((achievement) => {
            const isLocked =
              !achievement.unlocked &&
              achievement.id === "portfolio_5" &&
              plan === "free";

            return (
              <Grid item xs={12} sm={6} md={4} key={achievement.id}>
                <Tooltip title={achievement.description} placement="top" arrow>
                  <Box
                    onClick={() => handleAchievementClick(achievement)}
                    sx={{
                      cursor: isLocked ? "pointer" : "default",
                      position: "relative",
                    }}
                  >
                    <Chip
                      icon={
                        achievement.unlocked ? (
                          <WorkspacePremiumIcon sx={{ color: "#ffc107" }} />
                        ) : undefined
                      }
                      label={`${achievement.icon} ${achievement.label}`}
                      variant={achievement.unlocked ? "filled" : "outlined"}
                      color={
                        achievement.unlocked
                          ? "success"
                          : isLocked
                            ? "error"
                            : "default"
                      }
                      sx={{
                        width: "100%",
                        height: "auto",
                        py: 3,
                        px: 2,
                        fontSize: "0.95rem",
                        fontWeight: 600,
                        opacity: achievement.unlocked ? 1 : 0.6,
                        border:
                          achievement.unlocked && plan !== "free"
                            ? "2px solid #ffc107"
                            : undefined,
                        transition: "all 0.3s ease",
                        "&:hover": {
                          opacity: 1,
                          transform: achievement.unlocked
                            ? "scale(1.05)"
                            : "scale(0.98)",
                          boxShadow: achievement.unlocked
                            ? "0 4px 12px rgba(76, 175, 80, 0.3)"
                            : undefined,
                        },
                      }}
                    />

                    {/* Locked Badge */}
                    {isLocked && (
                      <Box
                        sx={{
                          position: "absolute",
                          top: -8,
                          right: -8,
                          bgcolor: "#ff5252",
                          color: "white",
                          borderRadius: "50%",
                          width: 24,
                          height: 24,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        🔒
                      </Box>
                    )}
                  </Box>
                </Tooltip>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {/* Upgrade Dialog */}
      <Dialog
        open={upgradeDialogOpen}
        onClose={() => setUpgradeDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          🔓 Desbloquea el Logro
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {selectedAchievement && (
            <Box>
              <Box sx={{ fontSize: "2rem", mb: 1 }}>
                {selectedAchievement.icon}
              </Box>
              <Box sx={{ fontWeight: 700, mb: 1, fontSize: "1.1rem" }}>
                {selectedAchievement.label}
              </Box>
              <Box sx={{ color: "text.secondary", mb: 3 }}>
                {selectedAchievement.description}
              </Box>
              <Box
                sx={{
                  bgcolor: "#f5f5f5",
                  p: 2,
                  borderRadius: 1,
                  mb: 2,
                }}
              >
                <Box sx={{ fontSize: "0.9rem", color: "text.secondary" }}>
                  El plan <strong>Pro</strong> te permite gestionar hasta{" "}
                  <strong>10 propiedades</strong> y acceder a análisis
                  avanzados, reportes personalizados y soporte prioritario.
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpgradeDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="primary"
            href="/billing"
            component="a"
          >
            Actualizar Plan
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
