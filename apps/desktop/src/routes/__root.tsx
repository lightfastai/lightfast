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

// This component consumes the auth context and handles redirects + renders the Outlet
function AppInternal() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();

  useEffect(() => {
    console.log("[AppInternal EFFECT] Auth State:", {
      isAuthenticated,
      loading,
      currentPath: router.state.location.pathname,
    });

    if (!loading) {
      if (isAuthenticated) {
        // If authenticated and on login page, redirect to main app
        if (router.state.location.pathname === "/login") {
          console.log(
            "[AppInternal EFFECT] Authenticated on /login, navigating to /",
          );
          // setTimeout to ensure navigation happens after current render cycle
          setTimeout(() => {
            navigate({ to: "/", replace: true });
          }, 0);
        }
      } else {
        // If not authenticated and not on login page, redirect to login
        if (router.state.location.pathname !== "/login") {
          console.log(
            "[AppInternal EFFECT] Not authenticated, not on /login, navigating to /login",
          );
          setTimeout(() => {
            navigate({ to: "/login", replace: true });
          }, 0);
        } else {
          console.log(
            "[AppInternal EFFECT] Not authenticated, already on /login. No navigation.",
          );
        }
      }
    } else {
      console.log("[AppInternal EFFECT] Still loading auth state.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, loading, router.state.location.pathname]); // Removed navigate from deps for stability test, will add back if needed

  console.log("[AppInternal RENDER] Path:", router.state.location.pathname);
  if (
    loading &&
    !isAuthenticated &&
    router.state.location.pathname !== "/login"
  ) {
    // Optional: Show a global loading spinner or minimal layout while auth is checked and not on login page
    // to prevent flashing content before a redirect to login.
    // However, your guard in routes.tsx might already handle this initial redirect.
    console.log(
      "[AppInternal RENDER] Initial auth load, potentially redirecting soon.",
    );
  }

  return <Outlet />; // Renders the matched child route (e.g., login page, main app page)
}

// This component is the root for the router and includes the AuthProvider.
function RootWithAuthProvider() {
  useEffect(() => {
    console.log("[RootWithAuthProvider] MOUNTED");
    return () => {
      console.log("[RootWithAuthProvider] UNMOUNTED");
    };
  }, []);

  return (
    <LightfastElectronAuthProvider>
      <AppInternal />
    </LightfastElectronAuthProvider>
  );
}

export const ComposerRootRoute = createRootRoute({
  component: RootWithAuthProvider,
  // Consider if the auth guard in "routes.tsx" can be moved here or its logic integrated
  // with the AppInternal component, which now has access to auth context.
  // For example, the beforeLoad here can check for persisted tokens directly
  // but might not have access to the full React context based auth state yet.
});
