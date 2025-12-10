import {
  Box,
  Tabs,
  Tab,
  Select,
  MenuItem,
  useMediaQuery,
  Theme,
  FormControl,
  InputLabel,
} from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Assessment";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import AssignmentIcon from "@mui/icons-material/Assignment";
import PaymentsIcon from "@mui/icons-material/Payments";
import BuildIcon from "@mui/icons-material/Build";
import FolderIcon from "@mui/icons-material/Folder";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import NotesIcon from "@mui/icons-material/Notes";
import { ReactElement } from "react";

export interface PropertyTabConfig {
  value: string;
  label: string;
  icon: ReactElement;
}

interface ResponsivePropertyTabsProps {
  value: string;
  onChange: (newValue: string) => void;
}

const TABS: PropertyTabConfig[] = [
  {
    value: "resumen",
    label: "Resumen",
    icon: <DescriptionIcon fontSize="small" />,
  },
  {
    value: "compra",
    label: "Compra",
    icon: <ShoppingCartIcon fontSize="small" />,
  },
  {
    value: "contrato",
    label: "Contrato de alquiler",
    icon: <AssignmentIcon fontSize="small" />,
  },
  {
    value: "gastos-fijos",
    label: "Gastos Fijos",
    icon: <PaymentsIcon fontSize="small" />,
  },
  {
    value: "capex",
    label: "Gastos Puntuales",
    icon: <BuildIcon fontSize="small" />,
  },
  { value: "docs", label: "Documentos", icon: <FolderIcon fontSize="small" /> },
  {
    value: "financiacion",
    label: "Financiación (Hipotecas)",
    icon: <AccountBalanceIcon fontSize="small" />,
  },
  { value: "notas", label: "Notas", icon: <NotesIcon fontSize="small" /> },
];

export function ResponsivePropertyTabs({
  value,
  onChange,
}: ResponsivePropertyTabsProps) {
  const isMobile = useMediaQuery((theme: Theme) =>
    theme.breakpoints.down("sm")
  );

  if (isMobile) {
    return (
      <Box
        sx={{
          p: 2,
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <FormControl fullWidth size="small">
          <InputLabel>Pestaña</InputLabel>
          <Select
            label="Pestaña"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            sx={{ minHeight: 48 }}
          >
            {TABS.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    );
  }

  return (
    <Tabs
      value={value}
      onChange={(_, v) => onChange(v)}
      variant="scrollable"
      scrollButtons="auto"
      allowScrollButtonsMobile
      sx={{
        "& .MuiTab-root": {
          minHeight: 48,
          fontSize: { xs: "0.75rem", sm: "0.875rem", md: "1rem" },
          alignItems: "center",
        },
      }}
    >
      {TABS.map((t) => (
        <Tab
          key={t.value}
          value={t.value}
          label={t.label}
          icon={t.icon}
          iconPosition="start"
          aria-label={t.label}
        />
      ))}
    </Tabs>
  );
}
