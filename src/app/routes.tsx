import {
  createBrowserRouter,
  createHashRouter,
  Navigate,
} from "react-router-dom";
import { Layout } from "@/components/Layout";
import { RequireAuth, RequireOrg } from "@/auth/guards";
import { RequireAdmin } from "@/auth/RequireAdmin";
import { LoginPage } from "@/auth/LoginPage";
import SignUp from "@/auth/SignUp";
import { OnboardingWizard } from "@/modules/onboarding/OnboardingWizard";
import { DashboardPage } from "@/modules/dashboard/DashboardPage";
import { PropertiesList } from "@/modules/properties/pages/PropertiesList";
import { PropertyCreate } from "@/modules/properties/pages/PropertyCreate";
import { PropertyDetail } from "@/modules/properties/pages/PropertyDetail";
import { ExpensesPage } from "@/modules/expenses/ExpensesPage";
import { CashflowPage } from "@/modules/cashflow/CashflowPage";
import { ReportsPage } from "@/modules/reports/ReportsPage";
import { SettingsPage } from "@/modules/settings/SettingsPage";
import { UsersPage } from "@/modules/users/UsersPage";
import { BillingPage } from "@/modules/billing/BillingPage";
import { BillingSuccessPage } from "@/modules/billing/BillingSuccessPage";
import { BillingCancelPage } from "@/modules/billing/BillingCancelPage";
import { DealAnalyzerPage } from "@/modules/deal-analyzer/DealAnalyzerPage";
import { isNative } from "./isNative";

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
    path: "/setup-org",
    element: (
      <RequireAuth>
        <OnboardingWizard />
      </RequireAuth>
    ),
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <RequireOrg>
          <Layout />
        </RequireOrg>
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: "dashboard",
        element: <DashboardPage />,
      },
      {
        path: "properties",
        element: <PropertiesList />,
      },
      {
        path: "properties/new",
        element: <PropertyCreate />,
      },
      {
        path: "properties/:id",
        element: <PropertyDetail />,
      },
      {
        path: "expenses",
        element: <ExpensesPage />,
      },
      {
        path: "cashflow",
        element: <CashflowPage />,
      },
      {
        path: "deal-analyzer",
        element: <DealAnalyzerPage />,
      },
      {
        path: "reports",
        element: <ReportsPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
      {
        path: "billing",
        element: <BillingPage />,
      },
      {
        path: "billing/success",
        element: <BillingSuccessPage />,
      },
      {
        path: "billing/cancel",
        element: <BillingCancelPage />,
      },
      {
        path: "users",
        element: (
          <RequireAdmin>
            <UsersPage />
          </RequireAdmin>
        ),
      },
    ],
  },
]);
