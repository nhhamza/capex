import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  createHashRouter,
  Navigate,
} from "react-router-dom";
import { Box, CircularProgress, Typography } from "@mui/material";
import { RootShell } from "@/app/RootShell";
import { RequireAuth, RequireBilling } from "@/auth/guards";
import { RequireAdmin } from "@/auth/RequireAdmin";
import { LoginPage } from "@/auth/LoginPage";
import SignUp from "@/auth/SignUp";
import { ForgotPasswordPage } from "@/auth/ForgotPasswordPage";
import { OnboardingWizard } from "@/modules/onboarding/OnboardingWizard";
import { BlockedPage } from "@/pages/BlockedPage";
import { TermsPage } from "@/pages/TermsPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { isNative } from "./isNative";

// Lazy load heavy pages for better performance
const DashboardPage = lazy(() => import("@/modules/dashboard/DashboardPage").then(m => ({ default: m.DashboardPage })));
const PropertiesList = lazy(() => import("@/modules/properties/pages/PropertiesList").then(m => ({ default: m.PropertiesList })));
const PropertyCreate = lazy(() => import("@/modules/properties/pages/PropertyCreate").then(m => ({ default: m.PropertyCreate })));
const PropertyDetail = lazy(() => import("@/modules/properties/pages/PropertyDetail").then(m => ({ default: m.PropertyDetail })));
const ExpensesPage = lazy(() => import("@/modules/expenses/ExpensesPage").then(m => ({ default: m.ExpensesPage })));
const CashflowPage = lazy(() => import("@/modules/cashflow/CashflowPage").then(m => ({ default: m.CashflowPage })));
const ReportsPage = lazy(() => import("@/modules/reports/ReportsPage").then(m => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import("@/modules/settings/SettingsPage").then(m => ({ default: m.SettingsPage })));
const UsersPage = lazy(() => import("@/modules/users/UsersPage").then(m => ({ default: m.UsersPage })));
const BillingPage = lazy(() => import("@/modules/billing/BillingPage").then(m => ({ default: m.BillingPage })));
const BillingSuccessPage = lazy(() => import("@/modules/billing/BillingSuccessPage").then(m => ({ default: m.BillingSuccessPage })));
const BillingCancelPage = lazy(() => import("@/modules/billing/BillingCancelPage").then(m => ({ default: m.BillingCancelPage })));
const DealAnalyzerPage = lazy(() => import("@/modules/deal-analyzer/DealAnalyzerPage").then(m => ({ default: m.DealAnalyzerPage })));

// Loading fallback component
const PageLoader = () => (
  <Box
    sx={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "60vh",
      gap: 2,
    }}
  >
    <CircularProgress size={48} />
    <Typography variant="body2" color="text.secondary">
      Cargando...
    </Typography>
  </Box>
);

// Wrapper to add Suspense to lazy-loaded components
const withSuspense = (Component: React.LazyExoticComponent<any>) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

const makeRouter = () => (isNative() ? createHashRouter : createBrowserRouter);

export const router = makeRouter()([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/signup",
    element: <SignUp />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
  },
  {
    path: "/terms",
    element: <TermsPage />,
  },
  {
    path: "/privacy",
    element: <PrivacyPage />,
  },
  {
    path: "/blocked",
    element: (
      <RequireAuth>
        <BlockedPage />
      </RequireAuth>
    ),
  },
  {
    path: "/setup-org",
    element: (
      <RequireAuth>
        <OnboardingWizard />
      </RequireAuth>
    ),
  },
  {
    path: "/",
    element: <RootShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: "dashboard",
        element: (
          <RequireBilling>
            {withSuspense(DashboardPage)}
          </RequireBilling>
        ),
      },
      {
        path: "properties",
        element: (
          <RequireBilling>
            {withSuspense(PropertiesList)}
          </RequireBilling>
        ),
      },
      {
        path: "properties/new",
        element: (
          <RequireBilling>
            {withSuspense(PropertyCreate)}
          </RequireBilling>
        ),
      },
      {
        path: "properties/:id",
        element: (
          <RequireBilling>
            {withSuspense(PropertyDetail)}
          </RequireBilling>
        ),
      },
      {
        path: "expenses",
        element: (
          <RequireBilling>
            {withSuspense(ExpensesPage)}
          </RequireBilling>
        ),
      },
      {
        path: "cashflow",
        element: (
          <RequireBilling>
            {withSuspense(CashflowPage)}
          </RequireBilling>
        ),
      },
      {
        path: "deal-analyzer",
        element: (
          <RequireBilling>
            {withSuspense(DealAnalyzerPage)}
          </RequireBilling>
        ),
      },
      {
        path: "reports",
        element: (
          <RequireBilling>
            {withSuspense(ReportsPage)}
          </RequireBilling>
        ),
      },
      {
        path: "settings",
        element: (
          <RequireBilling>
            {withSuspense(SettingsPage)}
          </RequireBilling>
        ),
      },
      {
        path: "billing",
        element: withSuspense(BillingPage),
      },
      {
        path: "billing/success",
        element: withSuspense(BillingSuccessPage),
      },
      {
        path: "billing/cancel",
        element: withSuspense(BillingCancelPage),
      },
      {
        path: "users",
        element: (
          <RequireBilling>
            <RequireAdmin>
              {withSuspense(UsersPage)}
            </RequireAdmin>
          </RequireBilling>
        ),
      },
    ],
  },
]);
