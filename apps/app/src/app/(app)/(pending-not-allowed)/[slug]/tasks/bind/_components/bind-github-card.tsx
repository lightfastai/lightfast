"use client";

import { useTRPC } from "@repo/app-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "@vendor/clerk/client";
import { Loader2 } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface BindGithubCardProps {
  orgSlug: string;
}

/**
 * v1 setup card — binds the active org to a source-control provider.
 *
 * Flow: `task.bind` writes the authoritative DB binding and mirrors `bound`
 * into Clerk org metadata; `session.reload()` then forces Clerk to re-mint the
 * session token so the fresh `lf_binding_status: "bound"` claim is present
 * before the `(bound)` layout gate runs on the next navigation.
 */
export function BindGithubCard({ orgSlug }: BindGithubCardProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const { session } = useSession();
  // Held true across session.reload() + navigation, after the mutation itself
  // has settled, so the button stays disabled until the workspace renders.
  const [isFinishing, setIsFinishing] = useState(false);

  const bindMutation = useMutation(
    trpc.pendingNotAllowed.task.bind.mutationOptions({
      meta: { errorTitle: "Failed to connect GitHub" },
    })
  );

  const isBusy = bindMutation.isPending || isFinishing;

  async function handleConnect() {
    if (isBusy) {
      return;
    }
    try {
      await bindMutation.mutateAsync();
    } catch {
      // Surfaced to the user by the useMutation meta.errorTitle handler.
      return;
    }
    setIsFinishing(true);
    // Refresh the Clerk session so the new lf_binding_status claim is minted
    // before the (bound) layout gate runs on the next navigation.
    await session?.reload();
    router.replace(`/${orgSlug}` as Route);
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connect GitHub</CardTitle>
          <CardDescription>
            Connect a GitHub organization to finish setting up this workspace.
            Lightfast features stay locked until your organization is connected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            disabled={isBusy}
            onClick={() => void handleConnect()}
          >
            {isBusy ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              "Connect GitHub"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
