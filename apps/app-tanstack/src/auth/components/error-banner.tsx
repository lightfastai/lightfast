import { Button } from "@repo/ui/components/ui/button";
import { Link } from "@tanstack/react-router";
import { AUTH_ERROR_MESSAGES, type AuthErrorCode } from "../search-params";

interface ErrorBannerProps {
  backUrl: string;
  errorCode?: AuthErrorCode | null;
  message?: string | null;
  redirectUrl?: string | null;
}

function authSearch(redirectUrl: string | null | undefined) {
  return redirectUrl ? { redirect_url: redirectUrl } : {};
}

function authHref(path: string, redirectUrl: string | null | undefined) {
  if (!redirectUrl) {
    return path;
  }

  const search = new URLSearchParams({ redirect_url: redirectUrl });
  return `${path}?${search.toString()}`;
}

export function ErrorBanner({
  message,
  errorCode,
  backUrl,
  redirectUrl,
}: ErrorBannerProps) {
  const displayMessage =
    message ??
    (errorCode ? AUTH_ERROR_MESSAGES[errorCode] : null) ??
    "An error occurred.";

  if (errorCode === "account_not_found") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-destructive/30 p-3">
          <p className="text-foreground text-sm">{displayMessage}</p>
        </div>
        <Button asChild className="w-full" size="lg">
          <Link search={authSearch(redirectUrl)} to="/sign-up">
            Sign up
          </Link>
        </Button>
        <Button asChild className="w-full" size="lg" variant="outline">
          <a href={authHref(backUrl, redirectUrl)}>Try again</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-destructive/30 p-3">
        <p className="text-foreground text-sm">{displayMessage}</p>
      </div>
      <Button asChild className="w-full" size="lg" variant="outline">
        <a href={authHref(backUrl, redirectUrl)}>Try again</a>
      </Button>
    </div>
  );
}
