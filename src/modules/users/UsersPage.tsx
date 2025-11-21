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
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { collection, getDocs, doc, getDoc } from "firebase/firestore/lite";
import { db } from "@/firebase/client";

type User = {
  id: string;
  email: string;
  orgId: string;
  role: "owner" | "member" | "admin";
  createdAt: string;
  plan?: string;
};

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

      // Fetch plan for each user's organization
      const usersWithPlans = await Promise.all(
        usersList.map(async (user) => {
          try {
            const orgSnap = await getDoc(doc(db, "orgs", user.orgId));
            const orgData = orgSnap.exists() ? orgSnap.data() : {};
            return {
              ...user,
              plan: orgData.plan ?? "free",
            };
          } catch (err) {
            console.error(`Error loading org for user ${user.id}:`, err);
            return {
              ...user,
              plan: "unknown",
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
                  <TableCell>ID Organización</TableCell>
                  <TableCell>Fecha Creación</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Chip
                        label={user.role}
                        color={getRoleColor(user.role)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getPlanLabel(user.plan)}
                        color={getPlanColor(user.plan)}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
