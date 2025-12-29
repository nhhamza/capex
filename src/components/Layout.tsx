import { useState, useEffect } from "react";
import {
  Outlet,
  useNavigate,
  useLocation,
  Link as RouterLink,
} from "react-router-dom";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Button,
  BottomNavigation,
  BottomNavigationAction,
  useMediaQuery,
  useTheme,
  Paper,
  Chip,
  Divider,
  Alert,
  Tooltip,
  Skeleton,
} from "@mui/material";

import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import ReceiptIcon from "@mui/icons-material/Receipt";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import PeopleIcon from "@mui/icons-material/People";
import UpgradeIcon from "@mui/icons-material/Upgrade";
import CalculateIcon from "@mui/icons-material/Calculate";
import ApartmentIcon from "@mui/icons-material/Apartment";
import ContactMailIcon from "@mui/icons-material/ContactMail";
import WarningIcon from "@mui/icons-material/Warning";

import { useAuth } from "@/auth/authContext";
import { useOrgBilling } from "@/hooks/useOrgBilling";

const DRAWER_WIDTH = 240;
const BOTTOM_NAV_HEIGHT = 56;

// Main navigation items for mobile bottom bar (limit to 4-5 for better UX)
const mobileMenuItems = [
  { label: "Dashboard", path: "/dashboard", icon: <DashboardIcon /> },
  { label: "Viviendas", path: "/properties", icon: <HomeWorkIcon /> },
  { label: "Cashflow", path: "/cashflow", icon: <AccountBalanceIcon /> },
  { label: "Más", path: "/settings", icon: <SettingsIcon /> },
];

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userDoc, logout } = useAuth();
  const {
    loading: planLoading,
    plan,
    billing,
    isGrace,
    refresh,
  } = useOrgBilling();

  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const isAdmin = userDoc?.role === "admin";

  const appName = "PropietarioPlus";
  const hasOrg = Boolean(userDoc?.orgId);
  const homePath = "/dashboard";

  const formatDate = (isoDate: string | undefined) => {
    if (!isoDate) return "";
    try {
      return new Date(isoDate).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return isoDate;
    }
  };

  // Refresh plan when navigating to billing or from success page
  useEffect(() => {
    if (
      location.pathname === "/billing" ||
      location.pathname.includes("/billing")
    ) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const getPlanColor = (planName?: string | null) => {
    switch (planName) {
      case "agency":
        return "error";
      case "pro":
        return "secondary";
      case "solo":
        return "primary";
      case "free":
        return "default";
      default:
        return "default";
    }
  };

  const getPlanLabel = (planName?: string | null) => {
    if (!planName) return "Free";
    return planName.charAt(0).toUpperCase() + planName.slice(1);
  };

  const handleUpgrade = () => {
    navigate("/billing");
    setMobileOpen(false);
  };

  const menuItems = [
    { label: "Dashboard", path: "/dashboard", icon: <DashboardIcon /> },
    { label: "Viviendas", path: "/properties", icon: <HomeWorkIcon /> },
    { label: "Gastos", path: "/expenses", icon: <ReceiptIcon /> },
    { label: "Cashflow", path: "/cashflow", icon: <AccountBalanceIcon /> },
    { label: "Reportes", path: "/reports", icon: <AssessmentIcon /> },
    ...(isAdmin
      ? [{ label: "Usuarios", path: "/users", icon: <PeopleIcon /> }]
      : []),
    { label: "Analizador", path: "/deal-analyzer", icon: <CalculateIcon /> },
    { label: "Configuración", path: "/settings", icon: <SettingsIcon /> },
  ];

  const handleDrawerToggle = () => {
    setMobileOpen((v) => !v);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const drawer = (
    <Box>
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{ minHeight: 48 }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}

        {/* Upgrade button for free plan users */}
        {!planLoading && plan === "free" && (
          <ListItem disablePadding>
            <ListItemButton
              onClick={handleUpgrade}
              sx={{
                minHeight: 48,
                bgcolor: "primary.main",
                color: "primary.contrastText",
                "&:hover": { bgcolor: "primary.dark" },
                mt: 1,
              }}
            >
              <ListItemIcon sx={{ color: "inherit" }}>
                <UpgradeIcon />
              </ListItemIcon>
              <ListItemText
                primary="Mejorar Plan"
                secondary={getPlanLabel(plan)}
                secondaryTypographyProps={{
                  sx: { color: "rgba(255,255,255,0.7)" },
                }}
              />
            </ListItemButton>
          </ListItem>
        )}
      </List>

      {/* Contact Information Section */}
      <Divider sx={{ mt: 2 }} />
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", mb: 1 }}>
          <ContactMailIcon
            sx={{ mr: 1, mt: 0.5, color: "primary.main", fontSize: 20 }}
          />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              ¿Necesitas ayuda?
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 1 }}
            >
              Si tienes cualquier duda, manda un mensaje a:
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "primary.main",
                fontWeight: 500,
                wordBreak: "break-all",
              }}
            >
              nh_hamza@hotmail.fr
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 1, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Brand: clickable logo + nicer title */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              flexGrow: 1,
              minWidth: 0,
            }}
          >
            <Tooltip title="Ir al inicio">
              <IconButton
                component={RouterLink}
                to={homePath}
                color="inherit"
                edge="start"
                sx={{
                  mr: 1,
                  borderRadius: 2,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.12)" },
                }}
              >
                <ApartmentIcon sx={{ fontSize: 26 }} />
              </IconButton>
            </Tooltip>

            <Box sx={{ minWidth: 0 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 1,
                  minWidth: 0,
                }}
              >
                <Typography
                  variant="h6"
                  noWrap
                  sx={{ fontWeight: 800, letterSpacing: 0.2, lineHeight: 1.1 }}
                >
                  {appName}
                </Typography>
              </Box>

              {hasOrg ? (
                <Typography
                  variant="caption"
                  noWrap
                  sx={{ opacity: 0.85, display: "block", lineHeight: 1.1 }}
                >
                  Gestión de alquileres
                </Typography>
              ) : (
                <Skeleton
                  variant="text"
                  width={160}
                  sx={{ transform: "none", opacity: 0.35, mt: 0.2 }}
                />
              )}
            </Box>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {!planLoading && (
              <>
                <Chip
                  label={getPlanLabel(plan)}
                  color={getPlanColor(plan)}
                  size="small"
                  onClick={handleUpgrade}
                  sx={{
                    display: { xs: "none", sm: "inline-flex" },
                    cursor: "pointer",
                    "&:hover": { opacity: 0.85 },
                  }}
                />
                {plan === "free" && (
                  <Button
                    color="inherit"
                    size="small"
                    startIcon={<UpgradeIcon />}
                    onClick={handleUpgrade}
                    sx={{
                      display: { xs: "none", md: "flex" },
                      borderColor: "rgba(255,255,255,0.5)",
                    }}
                    variant="outlined"
                  >
                    Mejorar Plan
                  </Button>
                )}
              </>
            )}

            <Typography
              variant="body2"
              sx={{ mr: 2, display: { xs: "none", sm: "block" } }}
            >
              {user?.email}
            </Typography>

            <Button
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              sx={{ display: { xs: "none", sm: "flex" } }}
            >
              Salir
            </Button>

            <IconButton
              color="inherit"
              onClick={handleLogout}
              sx={{ display: { xs: "flex", sm: "none" } }}
            >
              <LogoutIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Desktop: Side drawer */}
      {!isMobile && (
        <Box
          component="nav"
          sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
        >
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: "none", md: "block" },
              "& .MuiDrawer-paper": {
                boxSizing: "border-box",
                width: DRAWER_WIDTH,
                top: 64,
                height: "calc(100% - 64px)",
              },
            }}
            open
          >
            {drawer}
          </Drawer>
        </Box>
      )}

      {/* Mobile: Temporary drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: DRAWER_WIDTH,
            },
          }}
        >
          {drawer}
        </Drawer>
      )}

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          width: { xs: "100vw", md: `calc(100vw - ${DRAWER_WIDTH}px)` },
          maxWidth: { xs: "100vw", md: `calc(100vw - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          mb: { xs: `${BOTTOM_NAV_HEIGHT}px`, md: 0 },
          overflow: "auto",
          boxSizing: "border-box",
        }}
      >
        <Toolbar />

        {/* Grace period warning banner */}
        {isGrace && billing?.graceUntil && (
          <Alert
            severity="warning"
            icon={<WarningIcon />}
            sx={{ mb: 3 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => navigate("/billing")}
              >
                Actualizar
              </Button>
            }
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Problema con el pago
            </Typography>
            <Typography variant="body2">
              Tu suscripción tiene un problema de pago. Por favor, actualiza tu
              método de pago antes del{" "}
              <strong>{formatDate(billing.graceUntil)}</strong> para evitar la
              interrupción del servicio.
            </Typography>
          </Alert>
        )}

        <Outlet />
      </Box>

      {/* Mobile: Bottom navigation */}
      {isMobile && (
        <Paper
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: (t) => t.zIndex.appBar,
            display: { xs: "block", md: "none" },
          }}
          elevation={8}
        >
          <BottomNavigation
            value={location.pathname}
            onChange={(_, newValue) => navigate(newValue)}
            showLabels
            sx={{ height: BOTTOM_NAV_HEIGHT }}
          >
            {mobileMenuItems.map((item) => (
              <BottomNavigationAction
                key={item.path}
                label={item.label}
                value={item.path}
                icon={item.icon}
                sx={{
                  minWidth: "auto",
                  "& .MuiBottomNavigationAction-label": { fontSize: "0.75rem" },
                }}
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}
