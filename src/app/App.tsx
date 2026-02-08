import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "dayjs/locale/es";
import { AuthProvider } from "@/auth/authContext";
import { OrgBillingProvider } from "@/hooks/useOrgBilling";
import { router } from "./routes";
import { theme } from "./theme";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function App() {
  if (!googleClientId) {
    console.warn("VITE_GOOGLE_CLIENT_ID is not configured");
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId || ""}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
          <AuthProvider>
            <OrgBillingProvider>
              <RouterProvider router={router} />
            </OrgBillingProvider>
          </AuthProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
