"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "@vendor/clerk";
import { Loader2 } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTRPC } from "~/trpc/react";

interface GitHubBindCompleteClientProps {
  orgSlug: string;
}

export function GitHubBindCompleteClient({
  orgSlug,
}: GitHubBindCompleteClientProps) {
  const trpc = useTRPC();
  const router = useRouter();
  const { isLoaded: isSessionLoaded, session } = useSession();
  const [failed, setFailed] = useState(false);
  const hasStartedRef = useRef(false);

  const syncMutation = useMutation(
    trpc.org.setup.github.syncBindingClaim.mutationOptions({
      meta: { errorTitle: "Failed to finish GitHub connection" },
    })
  );
  const { mutateAsync } = syncMutation;

  const finish = useCallback(async () => {
    setFailed(false);

    if (!session) {
      setFailed(true);
      return;
    }

    try {
      const result = await mutateAsync();
      if (result.bindingStatus !== "bound") {
        setFailed(true);
        return;
      }

      await session.reload();
      router.replace(`/${orgSlug}` as Route);
    } catch {
      setFailed(true);
    }
  }, [mutateAsync, orgSlug, router, session]);

  useEffect(() => {
    if (!isSessionLoaded || hasStartedRef.current) {
      return;
    }

    if (!session) {
      setFailed(true);
      return;
    }

    hasStartedRef.current = true;
    void finish();
  }, [finish, isSessionLoaded, session]);

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 pb-32">
      <div className="w-full max-w-md space-y-4">
        <h1 className="font-medium font-pp text-2xl text-foreground">
          Finishing connection...
        </h1>
        <p className="text-muted-foreground text-sm">
          Lightfast is updating your team session.
        </p>
        {failed ? (
          <Button className="w-full" onClick={() => void finish()}>
            Retry
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Syncing GitHub binding
          </div>
        )}
      </div>
    </div>
  );
}
