import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { AUTH_ERROR_MESSAGES, type AuthErrorCode } from "../_lib/search-params";

interface ErrorBannerProps {
  backUrl: string;
  errorCode?: AuthErrorCode | null;
  message?: string | null;
}

export function ErrorBanner({ message, errorCode, backUrl }: ErrorBannerProps) {
  const displayMessage =
    message ??
    (errorCode ? AUTH_ERROR_MESSAGES[errorCode] : null) ??
    "An error occurred.";

  if (errorCode === "waitlist") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-destructive/30 p-3">
          <p className="text-foreground text-sm">{displayMessage}</p>
        </div>
        <Button asChild className="w-full" size="lg">
          <Link href="/early-access">
            Join the Waitlist
          </Link>
        </Button>
        <Button asChild className="w-full" size="lg" variant="outline">
          <a href={backUrl}>Back</a>
        </Button>
      </div>
    );
  }

  if (errorCode === "account_not_found") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-destructive/30 p-3">
          <p className="text-foreground text-sm">{displayMessage}</p>
        </div>
        <Button asChild className="w-full" size="lg">
          <a href="/sign-up">Sign Up</a>
        </Button>
        <Button asChild className="w-full" size="lg" variant="outline">
          <a href={backUrl}>Try again</a>
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
        <a href={backUrl}>Try again</a>
      </Button>
    </div>
  );
}
