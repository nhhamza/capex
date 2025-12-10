import { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Chip,
  Alert,
  TextField,
  IconButton,
  Select,
  MenuItem,
  SelectChangeEvent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteIcon from "@mui/icons-material/Delete";
import { collection, getDocs, doc, getDoc, updateDoc, setDoc, deleteDoc, query, where } from "firebase/firestore/lite";
import { db } from "@/firebase/client";
import { useAuth } from "@/auth/authContext";

type User = {
  id: string;
  email: string;
  orgId: string;
  role: "owner" | "member" | "admin";
  createdAt: string;
  plan?: string;
  propertyCount?: number;
};

export function UsersPage() {
  const { userDoc } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = userDoc?.role === "admin";

  const getPropertiesCount = async (orgId: string): Promise<number> => {
    try {
      const propertiesSnap = await getDocs(
        query(collection(db, "properties"), where("organizationId", "==", orgId))
      );
      return propertiesSnap.size;
    } catch (err) {
      console.error(`Error counting properties for org ${orgId}:`, err);
      return 0;
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load ALL users (no organization filter for admin)
      const snapshot = await getDocs(collection(db, "users"));
      const usersList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as User[];

      // Fetch plan and property count for each user's organization
      const usersWithPlans = await Promise.all(
        usersList.map(async (user) => {
          try {
            const orgSnap = await getDoc(doc(db, "orgs", user.orgId));
            const orgData = orgSnap.exists() ? orgSnap.data() : {};
            const propertyCount = await getPropertiesCount(user.orgId);
            return {
              ...user,
              plan: orgData.plan ?? "free",
              propertyCount,
            };
          } catch (err) {
            console.error(`Error loading org for user ${user.id}:`, err);
            return {
              ...user,
              plan: "unknown",
              propertyCount: 0,
            };
          }
        })
      );

      setUsers(usersWithPlans);
    } catch (err) {
      console.error("Error loading users:", err);
      setError("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!isAdmin) return;

    setUpdating(userId);
    setError(null);
    setSuccess(null);
    try {
      await updateDoc(doc(db, "users", userId), {
        role: newRole,
      });

      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole as User["role"] } : u))
      );
      setSuccess("Rol actualizado correctamente");
    } catch (err) {
      console.error("Error updating user role:", err);
      setError(`Error al actualizar el rol del usuario`);
    } finally {
      setUpdating(null);
    }
  };

  const handlePlanChange = async (userId: string, orgId: string, newPlan: string) => {
    if (!isAdmin) return;

    setUpdating(userId);
    setError(null);
    setSuccess(null);
    try {
      // Use setDoc with merge to create org document if it doesn't exist
      await setDoc(
        doc(db, "orgs", orgId),
        { plan: newPlan },
        { merge: true }
      );

      // Update local state for all users in this org
      setUsers((prev) =>
        prev.map((u) => (u.orgId === orgId ? { ...u, plan: newPlan } : u))
      );
      setSuccess("Plan actualizado correctamente");
    } catch (err) {
      console.error("Error updating org plan:", err);
      setError(`Error al actualizar el plan de la organización`);
    } finally {
      setUpdating(null);
    }
  };

  const handleDeleteClick = (user: User) => {
    if (!isAdmin) return;
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete || !isAdmin) return;

    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      const userId = userToDelete.id;
      const orgId = userToDelete.orgId;

      // Delete all properties for this user's organization
      const propertiesSnap = await getDocs(
        query(collection(db, "properties"), where("organizationId", "==", orgId))
      );
      for (const propertyDoc of propertiesSnap.docs) {
        // Delete all related data for this property
        const propertyId = propertyDoc.id;

        // Delete loans
        const loansSnap = await getDocs(
          query(collection(db, "loans"), where("propertyId", "==", propertyId))
        );
        for (const loanDoc of loansSnap.docs) {
          await deleteDoc(loanDoc.ref);
        }

        // Delete leases
        const leasesSnap = await getDocs(
          query(collection(db, "leases"), where("propertyId", "==", propertyId))
        );
        for (const leaseDoc of leasesSnap.docs) {
          await deleteDoc(leaseDoc.ref);
        }

        // Delete recurring expenses
        const recurringSnap = await getDocs(
          query(
            collection(db, "recurring_expenses"),
            where("propertyId", "==", propertyId)
          )
        );
        for (const expenseDoc of recurringSnap.docs) {
          await deleteDoc(expenseDoc.ref);
        }

        // Delete one-off expenses
        const oneOffSnap = await getDocs(
          query(
            collection(db, "one_off_expenses"),
            where("propertyId", "==", propertyId)
          )
        );
        for (const expenseDoc of oneOffSnap.docs) {
          await deleteDoc(expenseDoc.ref);
        }

        // Delete the property itself
        await deleteDoc(propertyDoc.ref);
      }

      // Delete the user document
      await deleteDoc(doc(db, "users", userId));

      // Remove from local state
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setSuccess(`Usuario ${userToDelete.email} eliminado correctamente con todos sus datos`);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    } catch (err) {
      console.error("Error deleting user:", err);
      setError(
        `Error al eliminar el usuario: ${err instanceof Error ? err.message : "Error desconocido"}`
      );
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = users.filter((user) =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleColor = (role: string) => {
    if (role === "admin") return "error";
    if (role === "owner") return "primary";
    return "default";
  };

  const getPlanColor = (plan?: string) => {
    switch (plan) {
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

  const getPlanLabel = (plan?: string) => {
    if (!plan || plan === "unknown") return "Unknown";
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  return (
    <Box sx={{ maxWidth: 1200, margin: "0 auto", p: { xs: 2, sm: 3 } }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h4">Usuarios</Typography>
        <IconButton onClick={loadUsers} disabled={loading}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}

      {!isAdmin && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Solo los administradores pueden modificar roles y planes de usuarios
        </Alert>
      )}

      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Buscar por email"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </Paper>

      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" gutterBottom>
          Todos los Usuarios ({filteredUsers.length})
        </Typography>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredUsers.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            No se encontraron usuarios
          </Typography>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Rol</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell align="right">Propiedades</TableCell>
                  <TableCell>ID Organización</TableCell>
                  <TableCell>Fecha Creación</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select
                          value={user.role}
                          onChange={(e: SelectChangeEvent) =>
                            handleRoleChange(user.id, e.target.value)
                          }
                          size="small"
                          disabled={updating === user.id}
                          sx={{ minWidth: 120 }}
                        >
                          <MenuItem value="member">member</MenuItem>
                          <MenuItem value="owner">owner</MenuItem>
                          <MenuItem value="admin">admin</MenuItem>
                        </Select>
                      ) : (
                        <Chip
                          label={user.role}
                          color={getRoleColor(user.role)}
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select
                          value={user.plan || "free"}
                          onChange={(e: SelectChangeEvent) =>
                            handlePlanChange(user.id, user.orgId, e.target.value)
                          }
                          size="small"
                          disabled={updating === user.id}
                          sx={{ minWidth: 120 }}
                        >
                          <MenuItem value="free">Free</MenuItem>
                          <MenuItem value="solo">Solo</MenuItem>
                          <MenuItem value="pro">Pro</MenuItem>
                          <MenuItem value="agency">Agency</MenuItem>
                        </Select>
                      ) : (
                        <Chip
                          label={getPlanLabel(user.plan)}
                          color={getPlanColor(user.plan)}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`${user.propertyCount || 0}`}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: "monospace",
                          fontSize: "0.75rem",
                          color: "text.secondary",
                        }}
                      >
                        {user.orgId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString("es-ES", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </TableCell>
                    <TableCell align="center">
                      {isAdmin && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteClick(user)}
                          disabled={deleting}
                          title="Eliminar usuario y todos sus datos"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirmar eliminación de usuario</DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph>
            ¿Estás seguro de que deseas eliminar el usuario <strong>{userToDelete?.email}</strong>?
          </Typography>
          <Typography variant="body2" color="error" paragraph>
            Esta acción eliminará:
          </Typography>
          <ul>
            <li>El usuario y su cuenta</li>
            <li>Todas sus {userToDelete?.propertyCount || 0} propiedades</li>
            <li>Todos los préstamos asociados</li>
            <li>Todos los contratos de arrendamiento</li>
            <li>Todos los gastos (recurrentes y puntuales)</li>
          </ul>
          <Typography variant="body2" color="error">
            <strong>Esta acción no se puede deshacer.</strong>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={deleting}
          >
            {deleting ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
