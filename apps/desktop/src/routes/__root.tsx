import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { createRootRoute, Outlet, useNavigate } from "@tanstack/react-router";

export const ComposerRootRoute = createRootRoute({
  component: ComposerRoot,
});

function ComposerRoot() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  // Handle authentication state changes
  useEffect(() => {
    console.log("Root route auth state:", { isAuthenticated, loading });

    if (!loading) {
      if (isAuthenticated) {
        // If authenticated and on login page, redirect to main app
        if (window.location.pathname === "/login") {
          console.log(
            "Authenticated but on login page - redirecting to main app",
          );
          navigate({ to: "/" });
        }
      } else {
        // If not authenticated and not on login page, redirect to login
        if (window.location.pathname !== "/login") {
          console.log("Not authenticated - redirecting to login");
          navigate({ to: "/login" });
        }
      }
    }
  }, [isAuthenticated, loading, navigate]);

  return <Outlet />;
}
