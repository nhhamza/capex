import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  IconButton,
  Collapse,
  TextField,
  Grid,
  Card,
  CardContent,
  TableSortLabel,
  InputAdornment,
} from "@mui/material";
import {
  AdminPanelSettings as AdminIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Dashboard as DashboardIcon,
} from "@mui/icons-material";
import { backendApi } from "@/lib/backendApi";

interface Organization {
  id: string;
  name: string;
  createdAt: string;
  plan: string;
  status: string;
  propertyLimit: number;
  seatLimit: number;
  usersCount: number;
  propertiesCount: number;
}

interface User {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

type OrderDirection = "asc" | "desc";
type OrderBy = "name" | "createdAt" | "plan" | "usersCount" | "propertiesCount";

const PLAN_COLORS = {
  free: "default",
  solo: "primary",
  pro: "secondary",
  agency: "success",
} as const;

const PLAN_NAMES = {
  free: "Free",
  solo: "Solo",
  pro: "Pro",
  agency: "Agency",
};

export function AdminPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters
  const [searchText, setSearchText] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Sorting
  const [orderBy, setOrderBy] = useState<OrderBy>("createdAt");
  const [orderDirection, setOrderDirection] = useState<OrderDirection>("desc");

  // Dialog states
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [newPlan, setNewPlan] = useState("");

  // Users expansion
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [orgUsers, setOrgUsers] = useState<Record<string, User[]>>({});
  const [loadingUsers, setLoadingUsers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await backendApi.get("/api/admin/organizations");
      setOrganizations(response.data.organizations || []);
    } catch (err: any) {
      console.error("Failed to load organizations:", err);
      if (err.response?.status === 403) {
        setError("Acceso denegado. Solo el super admin puede ver esta página.");
      } else {
        setError("Error al cargar organizaciones");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadOrgUsers = async (orgId: string) => {
    if (orgUsers[orgId]) {
      // Already loaded, just toggle
      setExpandedOrg(expandedOrg === orgId ? null : orgId);
      return;
    }

    try {
      setLoadingUsers({ ...loadingUsers, [orgId]: true });
      const response = await backendApi.get(`/api/admin/users/${orgId}`);
      setOrgUsers({ ...orgUsers, [orgId]: response.data.users || [] });
      setExpandedOrg(orgId);
    } catch (err) {
      console.error("Failed to load users:", err);
      setError("Error al cargar usuarios");
    } finally {
      setLoadingUsers({ ...loadingUsers, [orgId]: false });
    }
  };

  const handleUpgrade = async () => {
    if (!selectedOrg || !newPlan) return;

    try {
      setError("");
      setSuccess("");

      await backendApi.post("/api/admin/upgrade", {
        orgId: selectedOrg.id,
        plan: newPlan,
      });

      setSuccess(`✅ "${selectedOrg.name}" actualizada a plan ${PLAN_NAMES[newPlan as keyof typeof PLAN_NAMES]}`);
      setUpgradeDialogOpen(false);
      setSelectedOrg(null);
      setNewPlan("");

      // Reload organizations
      await loadOrganizations();
    } catch (err: any) {
      console.error("Failed to upgrade:", err);
      setError(err.response?.data?.error || "Error al actualizar plan");
    }
  };

  const openUpgradeDialog = (org: Organization) => {
    setSelectedOrg(org);
    setNewPlan(org.plan);
    setUpgradeDialogOpen(true);
  };

  const handleSort = (column: OrderBy) => {
    if (orderBy === column) {
      setOrderDirection(orderDirection === "asc" ? "desc" : "asc");
    } else {
      setOrderBy(column);
      setOrderDirection("asc");
    }
  };

  // Filtered and sorted organizations
  const filteredOrganizations = useMemo(() => {
    let filtered = [...organizations];

    // Search filter
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(
        (org) =>
          org.name.toLowerCase().includes(search) ||
          org.id.toLowerCase().includes(search)
      );
    }

    // Plan filter
    if (filterPlan !== "all") {
      filtered = filtered.filter((org) => org.plan === filterPlan);
    }

    // Status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((org) => org.status === filterStatus);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any = a[orderBy];
      let bValue: any = b[orderBy];

      // Handle dates
      if (orderBy === "createdAt") {
        aValue = new Date(aValue || 0).getTime();
        bValue = new Date(bValue || 0).getTime();
      }

      if (aValue < bValue) return orderDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return orderDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [organizations, searchText, filterPlan, filterStatus, orderBy, orderDirection]);

  // Statistics
  const stats = useMemo(() => {
    const total = organizations.length;
    const totalUsers = organizations.reduce((sum, org) => sum + org.usersCount, 0);
    const totalProperties = organizations.reduce((sum, org) => sum + org.propertiesCount, 0);
    const activeOrgs = organizations.filter((org) => org.status === "active").length;

    const planCounts = organizations.reduce((acc, org) => {
      acc[org.plan] = (acc[org.plan] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      totalUsers,
      totalProperties,
      activeOrgs,
      planCounts,
    };
  }, [organizations]);

  const formatDate = (isoDate: string) => {
    if (!isoDate) return "-";
    return new Date(isoDate).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
        <AdminIcon sx={{ fontSize: 40, color: "error.main" }} />
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Tanis - Panel de Control
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestión completa de organizaciones, usuarios y planes
          </Typography>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Organizaciones
                  </Typography>
                  <Typography variant="h4">{stats.total}</Typography>
                  <Typography variant="caption" color="success.main">
                    {stats.activeOrgs} activas
                  </Typography>
                </Box>
                <DashboardIcon sx={{ fontSize: 40, color: "primary.main", opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Usuarios
                  </Typography>
                  <Typography variant="h4">{stats.totalUsers}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    En {stats.total} orgs
                  </Typography>
                </Box>
                <PeopleIcon sx={{ fontSize: 40, color: "secondary.main", opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Propiedades
                  </Typography>
                  <Typography variant="h4">{stats.totalProperties}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Gestionadas
                  </Typography>
                </Box>
                <BusinessIcon sx={{ fontSize: 40, color: "success.main", opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Planes
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
                  {Object.entries(stats.planCounts).map(([plan, count]) => (
                    <Chip
                      key={plan}
                      label={`${PLAN_NAMES[plan as keyof typeof PLAN_NAMES]}: ${count}`}
                      size="small"
                      color={PLAN_COLORS[plan as keyof typeof PLAN_COLORS]}
                    />
                  ))}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess("")} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <FilterIcon />
          <Typography variant="h6">Filtros y Búsqueda</Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Buscar por nombre o ID..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Plan</InputLabel>
              <Select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)} label="Plan">
                <MenuItem value="all">Todos los planes</MenuItem>
                <MenuItem value="free">Free</MenuItem>
                <MenuItem value="solo">Solo</MenuItem>
                <MenuItem value="pro">Pro</MenuItem>
                <MenuItem value="agency">Agency</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel>Estado</InputLabel>
              <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} label="Estado">
                <MenuItem value="all">Todos los estados</MenuItem>
                <MenuItem value="active">Activo</MenuItem>
                <MenuItem value="canceled">Cancelado</MenuItem>
                <MenuItem value="past_due">Pago Vencido</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
        <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="body2" color="text.secondary">
            Mostrando {filteredOrganizations.length} de {organizations.length} organizaciones
          </Typography>
          {(searchText || filterPlan !== "all" || filterStatus !== "all") && (
            <Button
              size="small"
              onClick={() => {
                setSearchText("");
                setFilterPlan("all");
                setFilterStatus("all");
              }}
            >
              Limpiar Filtros
            </Button>
          )}
        </Box>
      </Paper>

      {/* Organizations Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={40}></TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === "name"}
                  direction={orderBy === "name" ? orderDirection : "asc"}
                  onClick={() => handleSort("name")}
                >
                  Organización
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === "plan"}
                  direction={orderBy === "plan" ? orderDirection : "asc"}
                  onClick={() => handleSort("plan")}
                >
                  Plan
                </TableSortLabel>
              </TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={orderBy === "usersCount"}
                  direction={orderBy === "usersCount" ? orderDirection : "asc"}
                  onClick={() => handleSort("usersCount")}
                >
                  Usuarios
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">
                <TableSortLabel
                  active={orderBy === "propertiesCount"}
                  direction={orderBy === "propertiesCount" ? orderDirection : "asc"}
                  onClick={() => handleSort("propertiesCount")}
                >
                  Propiedades
                </TableSortLabel>
              </TableCell>
              <TableCell align="center">Límites</TableCell>
              <TableCell>
                <TableSortLabel
                  active={orderBy === "createdAt"}
                  direction={orderBy === "createdAt" ? orderDirection : "asc"}
                  onClick={() => handleSort("createdAt")}
                >
                  Fecha Creación
                </TableSortLabel>
              </TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredOrganizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {searchText || filterPlan !== "all" || filterStatus !== "all"
                      ? "No se encontraron organizaciones con los filtros aplicados"
                      : "No hay organizaciones"}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredOrganizations.map((org) => (
                <>
                  <TableRow key={org.id} hover>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => loadOrgUsers(org.id)}
                        disabled={loadingUsers[org.id]}
                      >
                        {loadingUsers[org.id] ? (
                          <CircularProgress size={20} />
                        ) : expandedOrg === org.id ? (
                          <ExpandLessIcon />
                        ) : (
                          <ExpandMoreIcon />
                        )}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <BusinessIcon fontSize="small" color="action" />
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {org.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                            {org.id}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={PLAN_NAMES[org.plan as keyof typeof PLAN_NAMES] || org.plan}
                        color={PLAN_COLORS[org.plan as keyof typeof PLAN_COLORS] || "default"}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={org.status}
                        color={org.status === "active" ? "success" : "warning"}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
                        <PeopleIcon fontSize="small" color="action" />
                        <Typography variant="body2" fontWeight={org.usersCount >= org.seatLimit ? "bold" : "normal"}
                          color={org.usersCount >= org.seatLimit ? "error.main" : "inherit"}>
                          {org.usersCount} / {org.seatLimit}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" fontWeight={org.propertiesCount >= org.propertyLimit ? "bold" : "normal"}
                        color={org.propertiesCount >= org.propertyLimit ? "error.main" : "inherit"}>
                        {org.propertiesCount} / {org.propertyLimit}
                      </Typography>
                      {org.propertiesCount >= org.propertyLimit && (
                        <Typography variant="caption" color="error">
                          ⚠️ Límite alcanzado
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="caption" color="text.secondary">
                        {org.propertyLimit} props
                        <br />
                        {org.seatLimit} seats
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDate(org.createdAt)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => openUpgradeDialog(org)}
                      >
                        Cambiar Plan
                      </Button>
                    </TableCell>
                  </TableRow>

                  {/* Expanded row showing users */}
                  {expandedOrg === org.id && orgUsers[org.id] && (
                    <TableRow>
                      <TableCell colSpan={9} sx={{ py: 0 }}>
                        <Collapse in={expandedOrg === org.id} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 2, px: 4, bgcolor: "action.hover" }}>
                            <Typography variant="subtitle2" gutterBottom>
                              👥 Usuarios de {org.name} ({orgUsers[org.id].length})
                            </Typography>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell>Email</TableCell>
                                  <TableCell>ID de Usuario</TableCell>
                                  <TableCell>Role</TableCell>
                                  <TableCell>Fecha Creación</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {orgUsers[org.id].map((user) => (
                                  <TableRow key={user.id}>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                      <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                                        {user.id}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>
                                      <Chip
                                        label={user.role}
                                        size="small"
                                        color={user.role === "admin" ? "primary" : "default"}
                                      />
                                    </TableCell>
                                    <TableCell>{formatDate(user.createdAt)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Upgrade Dialog */}
      <Dialog open={upgradeDialogOpen} onClose={() => setUpgradeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cambiar Plan de Organización</DialogTitle>
        <DialogContent>
          {selectedOrg && (
            <Box sx={{ pt: 2 }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2" gutterBottom>
                  <strong>Organización:</strong> {selectedOrg.name}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Plan actual:</strong> {PLAN_NAMES[selectedOrg.plan as keyof typeof PLAN_NAMES]}
                </Typography>
                <Typography variant="body2">
                  <strong>Uso actual:</strong> {selectedOrg.propertiesCount} propiedades, {selectedOrg.usersCount} usuarios
                </Typography>
              </Alert>

              <FormControl fullWidth>
                <InputLabel>Nuevo Plan</InputLabel>
                <Select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value)}
                  label="Nuevo Plan"
                >
                  <MenuItem value="free">
                    <Box>
                      <Typography variant="body2" fontWeight="bold">Free</Typography>
                      <Typography variant="caption" color="text.secondary">
                        1 propiedad, 1 usuario
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="solo">
                    <Box>
                      <Typography variant="body2" fontWeight="bold">Solo</Typography>
                      <Typography variant="caption" color="text.secondary">
                        10 propiedades, 1 usuario
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="pro">
                    <Box>
                      <Typography variant="body2" fontWeight="bold">Pro</Typography>
                      <Typography variant="caption" color="text.secondary">
                        50 propiedades, 3 usuarios
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="agency">
                    <Box>
                      <Typography variant="body2" fontWeight="bold">Agency</Typography>
                      <Typography variant="caption" color="text.secondary">
                        200 propiedades, 10 usuarios
                      </Typography>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              {newPlan && newPlan !== selectedOrg.plan && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Los cambios se aplicarán inmediatamente. Los usuarios verán los nuevos límites al refrescar.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpgradeDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleUpgrade} variant="contained" disabled={!newPlan || newPlan === selectedOrg?.plan}>
            Actualizar Plan
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
