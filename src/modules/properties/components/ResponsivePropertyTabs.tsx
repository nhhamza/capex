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
import FolderIcon from "@mui/icons-material/Folder";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import { ReactElement } from "react";
import { RentalMode } from "../types";

export interface PropertyTabConfig {
  value: string;
  label: string;
  icon: ReactElement;
  hidden?: boolean;
}

interface ResponsivePropertyTabsProps {
  value: string;
  onChange: (newValue: string) => void;
  rentalMode?: RentalMode;
}

const getTabs = (rentalMode?: RentalMode): PropertyTabConfig[] => [
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
    value: "financiacion",
    label: "Financiación (Hipotecas)",
    icon: <AccountBalanceIcon fontSize="small" />,
  },
  {
    value: "habitaciones",
    label: "Habitaciones",
    icon: <MeetingRoomIcon fontSize="small" />,
    hidden: rentalMode !== "PER_ROOM",
  },
  {
    value: "contrato",
    label: "Contrato de alquiler",
    icon: <AssignmentIcon fontSize="small" />,
  },
  {
    value: "gastos",
    label: "Gastos",
    icon: <PaymentsIcon fontSize="small" />,
  },
  { value: "docs", label: "Documentos", icon: <FolderIcon fontSize="small" /> },
];

export function ResponsivePropertyTabs({
  value,
  onChange,
  rentalMode,
}: ResponsivePropertyTabsProps) {
  const isMobile = useMediaQuery((theme: Theme) =>
    theme.breakpoints.down("sm")
  );

  const tabs = getTabs(rentalMode).filter((t) => !t.hidden);

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
            {tabs.map((t) => (
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
      {tabs.map((t) => (
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
