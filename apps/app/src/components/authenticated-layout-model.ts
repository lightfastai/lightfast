const BASIC_SHELL_PREFIXES = ["/account", "/accounts"] as const;
const AUTH_ROUTES = ["/sign-in", "/sign-up"] as const;

export function usesRouteOwnedAuthenticatedShell(pathname: string) {
  if (AUTH_ROUTES.some((path) => pathname === path)) {
    return false;
  }

  return !BASIC_SHELL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
