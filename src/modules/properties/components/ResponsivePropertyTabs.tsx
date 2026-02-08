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
import LightningBoltIcon from "@mui/icons-material/FlashlightOn";
import PaymentIcon from "@mui/icons-material/Payment";
import ReceiptIcon from "@mui/icons-material/Receipt";
import DescriptionIcon from "@mui/icons-material/Description";
import AnalyticsIcon from "@mui/icons-material/Analytics";
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

const getTabs = (): PropertyTabConfig[] => [
  {
    value: "quick",
    label: "⚡ Vista Rápida",
    icon: <LightningBoltIcon fontSize="small" />,
  },
  {
    value: "ingresos",
    label: "💵 Ingresos",
    icon: <PaymentIcon fontSize="small" />,
  },
  {
    value: "gastos",
    label: "💳 Gastos",
    icon: <ReceiptIcon fontSize="small" />,
  },
  {
    value: "datos",
    label: "📋 Datos",
    icon: <DescriptionIcon fontSize="small" />,
  },
  {
    value: "resumen",
    label: "📊 Métricas",
    icon: <AnalyticsIcon fontSize="small" />,
  },
];

export function ResponsivePropertyTabs({
  value,
  onChange,
}: ResponsivePropertyTabsProps) {
  const isMobile = useMediaQuery((theme: Theme) =>
    theme.breakpoints.down("sm"),
  );

  const tabs = getTabs().filter((t) => !t.hidden);

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
