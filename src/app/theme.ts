import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc004e",
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    fontSize: 16, // Increased from default 14 for better mobile readability
    button: {
      fontSize: "1rem",
      fontWeight: 600,
    },
  },
  spacing: 8, // 8px base unit
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          overflowX: "hidden",
        },
        "*": {
          boxSizing: "border-box",
        },
        "img, video": {
          maxWidth: "100%",
          height: "auto",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 48, // Larger touch target for mobile
          paddingTop: 12,
          paddingBottom: 12,
          paddingLeft: 24,
          paddingRight: 24,
          borderRadius: 8,
          textTransform: "none",
          fontSize: "1rem",
        },
        sizeLarge: {
          minHeight: 56,
          paddingTop: 16,
          paddingBottom: 16,
          fontSize: "1.125rem",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 48,
          minHeight: 48,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiInputBase-root": {
            minHeight: 48,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          height: 32,
          fontSize: "0.875rem",
        },
      },
    },
  },
});
