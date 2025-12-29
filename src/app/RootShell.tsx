import { useLocation } from "react-router-dom";
import { HomePage } from "@/pages/HomePage";
import { RequireAuth, RequireOrg } from "@/auth/guards";
import { Layout } from "@/components/Layout";

/**
 * Root shell that keeps your existing URLs intact.
 * - "/" shows the public marketing home.
 * - Any other path behaves exactly like before (auth + org + layout).
 */
export function RootShell() {
  const location = useLocation();

  // Public landing only on exact "/"
  if (location.pathname === "/") {
    return <HomePage />;
  }

  // Everything else remains protected like before
  return (
    <RequireAuth>
      <RequireOrg>
        <Layout />
      </RequireOrg>
    </RequireAuth>
  );
}
