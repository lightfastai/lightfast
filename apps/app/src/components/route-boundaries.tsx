import { Loading03Icon as Loader2 } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/ui/button";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { SidebarTrigger } from "@repo/ui-v2/components/ui/sidebar";
import * as Sentry from "@sentry/tanstackstart-react";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

function MobileSidebarFallbackTrigger() {
  return (
    <SidebarTrigger className="absolute top-3 left-3 size-6 rounded-lg border border-border/70 bg-muted/30 p-0 text-muted-foreground hover:bg-muted/60 hover:text-foreground md:hidden" />
  );
}

export function WorkspaceRoutePending({
  className,
  label,
}: {
  className?: string;
  label: string;
}) {
  return (
    <div
      aria-label={label}
      className={cn(
        "relative flex min-h-40 items-center justify-center bg-background",
        className
      )}
      role="status"
    >
      <MobileSidebarFallbackTrigger />
      <HugeiconsIcon
        aria-hidden="true"
        className="size-6 animate-spin text-muted-foreground"
        icon={Loader2}
      />
    </div>
  );
}

export function AutomationFormRoutePending() {
  return (
    <div className="relative min-h-full bg-background text-foreground">
      <MobileSidebarFallbackTrigger />
      <div
        aria-label="Loading new automation form"
        className="mx-auto w-full max-w-2xl px-6 py-10"
        role="status"
      >
        <Skeleton className="mb-8 h-8 w-20" />

        <div className="space-y-8">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>

          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-48 w-full" />
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-16" />
                <Skeleton className="h-9 w-16" />
              </div>
            </div>

            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-40" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceRouteErrorPanel({
  backHref,
  backLabel,
  description,
  error,
  maxWidth = "max-w-xl",
  reset,
  route,
  title,
}: {
  backHref?: string;
  backLabel?: string;
  description: string;
  error: Error & { digest?: string };
  maxWidth?: string;
  reset?: () => void;
  route: string;
  title: string;
}) {
  const router = useRouter();

  useEffect(() => {
    Sentry.captureException(error, {
      extra: {
        errorDigest: error.digest,
      },
      tags: {
        route,
      },
    });
  }, [error, route]);

  return (
    <main className="relative flex min-h-full w-full items-center justify-center bg-background px-6 py-10">
      <MobileSidebarFallbackTrigger />
      <section
        className={cn(
          "w-full space-y-4 rounded-sm border border-border/60 px-5 py-6",
          maxWidth
        )}
      >
        <div>
          <h2 className="font-medium text-foreground text-lg">{title}</h2>
          <p className="mt-2 text-muted-foreground text-sm">{description}</p>
          {error.digest ? (
            <p className="mt-3 text-muted-foreground text-xs">
              Error ID: {error.digest}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => {
              reset?.();
              void router.invalidate();
            }}
            size="sm"
            type="button"
          >
            Try again
          </Button>
          {backHref && backLabel ? (
            <Button asChild size="sm" type="button" variant="outline">
              <a href={backHref}>{backLabel}</a>
            </Button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
