import { Button } from "@repo/ui/components/ui/button";
import { Link as MicrofrontendLink } from "@vercel/microfrontends/next/client";

interface ErrorBannerProps {
  backUrl: string;
  isWaitlist: boolean;
  message: string;
}

export function ErrorBanner({
  message,
  isWaitlist,
  backUrl,
}: ErrorBannerProps) {
  if (isWaitlist) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-destructive/30 p-3">
          <p className="text-foreground text-sm">{message}</p>
        </div>
        <Button asChild className="w-full" size="lg">
          <MicrofrontendLink href="/early-access">
            Join the Waitlist
          </MicrofrontendLink>
        </Button>
        <Button asChild className="w-full" size="lg" variant="outline">
          <a href={backUrl}>Back</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
        <p className="text-red-800 text-sm">{message}</p>
      </div>
      <Button asChild className="w-full" size="lg" variant="outline">
        <a href={backUrl}>Try again</a>
      </Button>
    </div>
  );
}
