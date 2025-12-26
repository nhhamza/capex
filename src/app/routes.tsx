import {
  createBrowserRouter,
  createHashRouter,
  Navigate,
} from "react-router-dom";
import { Layout } from "@/components/Layout";
import { RequireAuth, RequireOrg, RequireBilling } from "@/auth/guards";
import { RequireAdmin } from "@/auth/RequireAdmin";
import { LoginPage } from "@/auth/LoginPage";
import SignUp from "@/auth/SignUp";
import { ForgotPasswordPage } from "@/auth/ForgotPasswordPage";
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
import { BlockedPage } from "@/pages/BlockedPage";
import { TermsPage } from "@/pages/TermsPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
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
        element: (
          <RequireBilling>
            <DashboardPage />
          </RequireBilling>
        ),
      },
      {
        path: "properties",
        element: (
          <RequireBilling>
            <PropertiesList />
          </RequireBilling>
        ),
      },
      {
        path: "properties/new",
        element: (
          <RequireBilling>
            <PropertyCreate />
          </RequireBilling>
        ),
      },
      {
        path: "properties/:id",
        element: (
          <RequireBilling>
            <PropertyDetail />
          </RequireBilling>
        ),
      },
      {
        path: "expenses",
        element: (
          <RequireBilling>
            <ExpensesPage />
          </RequireBilling>
        ),
      },
      {
        path: "cashflow",
        element: (
          <RequireBilling>
            <CashflowPage />
          </RequireBilling>
        ),
      },
      {
        path: "deal-analyzer",
        element: (
          <RequireBilling>
            <DealAnalyzerPage />
          </RequireBilling>
        ),
      },
      {
        path: "reports",
        element: (
          <RequireBilling>
            <ReportsPage />
          </RequireBilling>
        ),
      },
      {
        path: "settings",
        element: (
          <RequireBilling>
            <SettingsPage />
          </RequireBilling>
        ),
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
          <RequireBilling>
            <RequireAdmin>
              <UsersPage />
            </RequireAdmin>
          </RequireBilling>
        ),
      },
    ],
  },
]);
