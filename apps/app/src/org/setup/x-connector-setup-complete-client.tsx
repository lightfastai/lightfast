import { useSession } from "@clerk/tanstack-react-start";
import type { OrgSetupRequirement } from "@repo/app-setup-contract";
import { pathForSetupRequirement } from "@repo/app-setup-contract";
import { Button } from "@repo/ui/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Loading03Icon as Loader2,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TeamSwitcherSlot } from "~/components/team-switcher";
import { useTRPC } from "~/trpc/react";

interface XConnectorSetupCompleteClientProps {
  orgSlug: string;
}

export function XConnectorSetupCompleteClient({
  orgSlug,
}: XConnectorSetupCompleteClientProps) {
  const navigate = useNavigate();
  const trpc = useTRPC();
  const { isLoaded: isSessionLoaded, session } = useSession();
  const [failed, setFailed] = useState(false);
  const hasStartedRef = useRef(false);

  const syncMutation = useMutation(
    trpc.org.setup.github.syncBindingClaim.mutationOptions({
      meta: { errorTitle: "Failed to finish X connection" },
    })
  );
  const { mutateAsync } = syncMutation;

  const navigateToRequirement = useCallback(
    async (requirement: OrgSetupRequirement) => {
      const setupPath = pathForSetupRequirement({
        orgSlug,
        requirement,
      });
      if (setupPath.endsWith("/tasks/github/lightfast-repo")) {
        await navigate({
          params: { slug: orgSlug },
          to: "/$slug/tasks/github/lightfast-repo",
        });
        return;
      }
      if (setupPath.endsWith("/tasks/connectors/x")) {
        await navigate({
          params: { slug: orgSlug },
          to: "/$slug/tasks/connectors/x",
        });
        return;
      }
      await navigate({ params: { slug: orgSlug }, to: "/$slug/tasks/bind" });
    },
    [navigate, orgSlug]
  );

  const finish = useCallback(async () => {
    setFailed(false);

    if (!session) {
      setFailed(true);
      return;
    }

    try {
      const result = await mutateAsync();
      if (result.bindingStatus !== "bound" && !result.nextSetupRequirement) {
        setFailed(true);
        return;
      }

      await session.reload();
      if (result.nextSetupRequirement) {
        await navigateToRequirement(result.nextSetupRequirement);
        return;
      }
      await navigate({ params: { slug: orgSlug }, to: "/$slug" });
    } catch {
      setFailed(true);
    }
  }, [mutateAsync, navigate, navigateToRequirement, orgSlug, session]);

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
        <TeamSwitcherSlot />
        <h1 className="font-medium font-pp text-2xl text-foreground">
          Finishing X connection...
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
            <HugeiconsIcon icon={Loader2} className="h-4 w-4 animate-spin" />
            Syncing X connector
          </div>
        )}
      </div>
    </div>
  );
}
