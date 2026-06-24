import { useUser } from "@clerk/tanstack-react-start";
import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";

const BASIC_SHELL_PREFIXES = ["/account", "/accounts"] as const;
const AUTH_ROUTE_PATHS = new Set(["/sign-in", "/sign-up"]);

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isLoaded, isSignedIn } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const isAuthRoute = AUTH_ROUTE_PATHS.has(location.pathname);
  const usesBasicShell = BASIC_SHELL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  useEffect(() => {
    if (!isLoaded || isSignedIn || isAuthRoute) {
      return;
    }

    void navigate({
      replace: true,
      search: { redirect_url: location.href },
      to: "/sign-in",
    });
  }, [isAuthRoute, isLoaded, isSignedIn, location.href, navigate]);

  if (isAuthRoute) {
    return null;
  }

  if (!(isLoaded && isSignedIn)) {
    return <AuthenticatedShellSkeleton />;
  }

  if (!usesBasicShell) {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <div className="relative flex flex-1 flex-col overflow-y-auto bg-background">
        <Outlet />
      </div>
    </div>
  );
}

function AuthenticatedShellSkeleton() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <div className="h-5 w-32 rounded-md bg-muted" />
        <div className="size-8 rounded-md bg-muted" />
      </div>
      <div className="grid flex-1 place-items-center px-4">
        <div className="h-5 w-48 rounded-md bg-muted" />
      </div>
    </div>
  );
}
