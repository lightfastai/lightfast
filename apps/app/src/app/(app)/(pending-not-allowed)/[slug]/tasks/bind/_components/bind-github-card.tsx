"use client";

import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { useTRPC } from "~/trpc/react";

interface BindGithubCardProps {
  orgSlug: string;
}

/**
 * v1 setup surface — starts the GitHub App installation flow for this org.
 */
export function BindGithubCard({ orgSlug }: BindGithubCardProps) {
  const trpc = useTRPC();

  const bindMutation = useMutation(
    trpc.org.setup.github.start.mutationOptions({
      meta: { errorTitle: "Failed to connect GitHub" },
    })
  );

  async function handleConnect() {
    if (bindMutation.isPending) {
      return;
    }

    try {
      const result = await bindMutation.mutateAsync({ orgSlug });
      window.location.assign(result.installationUrl);
    } catch {
      // Surfaced to the user by the useMutation meta.errorTitle handler.
    }
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 pb-32">
      <div className="w-full max-w-md space-y-4">
        <div className="w-fit rounded-sm bg-card p-3">
          <Icons.logoShort className="h-5 w-5 text-foreground" />
        </div>

        <div className="space-y-4">
          <h1 className="pb-4 font-medium font-pp text-2xl text-foreground">
            Connect a GitHub organization
          </h1>

          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Bind one GitHub organization to this Lightfast team so the
              workspace has an org-level source-control connection.
            </p>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <p className="min-w-0 truncate font-mono text-muted-foreground text-sm">
                  lightfast.ai/{orgSlug}
                </p>
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 text-muted-foreground"
                />
                <div className="flex min-w-0 items-center gap-2 text-muted-foreground text-sm">
                  <Icons.github
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0"
                  />
                  <span className="truncate">GitHub organization</span>
                </div>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={bindMutation.isPending}
              onClick={() => void handleConnect()}
            >
              {bindMutation.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Icons.github aria-hidden="true" className="h-4 w-4" />
                  Connect GitHub organization
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
