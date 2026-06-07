import { Button } from "@repo/ui/components/ui/button";
import { Link, useRouterState } from "@tanstack/react-router";

export function AuthHeaderCta() {
  const { pathname, redirectUrl } = useRouterState({
    select: (state) => {
      const search = state.location.search as { redirect_url?: unknown };
      const redirectValue = search.redirect_url;
      return {
        pathname: state.location.pathname,
        redirectUrl:
          typeof redirectValue === "string" ? redirectValue : undefined,
      };
    },
  });
  const isSignIn = pathname === "/sign-in";
  const search = redirectUrl ? { redirect_url: redirectUrl } : {};

  if (isSignIn) {
    return (
      <Button asChild className="rounded-full" size="lg" variant="secondary">
        <Link search={search} to="/sign-up">
          Sign up
        </Link>
      </Button>
    );
  }

  return (
    <Button asChild className="rounded-full" size="lg" variant="secondary">
      <Link search={search} to="/sign-in">
        Log in
      </Link>
    </Button>
  );
}
