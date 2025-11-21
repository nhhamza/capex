import { Card, CardContent, Typography, Box, Tooltip } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

interface KPIProps {
  label: string;
  value: string | number;
  unit?: string;
  color?: "primary" | "secondary" | "success" | "error" | "warning";
  description?: string;
}

export function KPI({
  label,
  value,
  unit,
  color = "primary",
  description,
}: KPIProps) {
  return (
    <Card>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" } }}
          >
            {label}
          </Typography>
          {description && (
            <Tooltip
              title={description}
              arrow
              placement="top"
              enterTouchDelay={0}
              leaveTouchDelay={3000}
              componentsProps={{
                tooltip: {
                  sx: {
                    bgcolor: "background.paper",
                    color: "text.primary",
                    border: "1px solid",
                    borderColor: "divider",
                    boxShadow: 2,
                    fontSize: { xs: "0.75rem", sm: "0.8rem" },
                    maxWidth: { xs: 250, sm: 300 },
                    p: { xs: 1.5, sm: 2 },
                  },
                },
                arrow: {
                  sx: {
                    color: "background.paper",
                    "&::before": {
                      border: "1px solid",
                      borderColor: "divider",
                    },
                  },
                },
              }}
            >
              <InfoOutlinedIcon
                sx={{
                  fontSize: { xs: "1.1rem", sm: "1rem" },
                  color: "text.disabled",
                  cursor: "help",
                  minWidth: { xs: 24, sm: 20 },
                  minHeight: { xs: 24, sm: 20 },
                  p: { xs: 0.25, sm: 0 },
                  "&:hover": { color: "primary.main" },
                  "&:active": { color: "primary.dark" },
                }}
              />
            </Tooltip>
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "baseline" }}>
          <Typography
            variant="h4"
            component="div"
            color={`${color}.main`}
            sx={{ fontSize: { xs: "1.5rem", sm: "2rem" } }}
          >
            {value}
          </Typography>
          {unit && (
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{
                ml: 1,
                fontSize: { xs: "0.875rem", sm: "1rem" },
              }}
            >
              {unit}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
