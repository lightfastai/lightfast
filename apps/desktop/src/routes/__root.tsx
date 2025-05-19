import { useEffect } from "react";
import {
  LightfastElectronAuthProvider,
  useAuth,
} from "@/providers/auth-provider";
import {
  createRootRoute,
  Outlet,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";

export const ComposerRootRoute = createRootRoute({
  component: ComposerRoot,
});

function ComposerRoot() {
  return (
    <LightfastElectronAuthProvider>
      <AuthenticatedLayout />
    </LightfastElectronAuthProvider>
  );
}

// This component uses the auth context and handles redirects
function AuthenticatedLayout() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();

  // Handle authentication state changes
  useEffect(() => {
    console.log("Root route auth state:", {
      isAuthenticated,
      loading,
      currentPath: router.state.location.pathname,
    });

    if (!loading) {
      if (isAuthenticated) {
        // If authenticated and on login page, redirect to main app
        if (router.state.location.pathname === "/login") {
          console.log("Authenticated - redirecting to main app");
          // Use setTimeout to ensure this happens after current render cycle
          setTimeout(() => {
            navigate({ to: "/" });
          }, 0);
        }
      } else {
        // If not authenticated and not on login page, redirect to login
        if (router.state.location.pathname !== "/login") {
          console.log("Not authenticated - redirecting to login");
          // Use setTimeout to ensure this happens after current render cycle
          setTimeout(() => {
            navigate({ to: "/login" });
          }, 0);
        }
      }
    }
  }, [isAuthenticated, loading, navigate, router.state.location.pathname]);

  return <Outlet />;
}
