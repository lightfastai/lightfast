import { Button } from "@repo/ui/components/ui/button";

interface ErrorBannerProps {
  backUrl: string;
  message: string;
}

export function ErrorBanner({ message, backUrl }: ErrorBannerProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-destructive/30 p-3">
        <p className="text-foreground text-sm">{message}</p>
      </div>
      <Button asChild className="w-full" variant="outline">
        <a href={backUrl}>Try again</a>
      </Button>
    </div>
  );
}
