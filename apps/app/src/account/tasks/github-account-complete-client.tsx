import { normalizeGitHubUserAccountReturnTo } from "@repo/github-app-contract";
import { Button } from "@repo/ui/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { syncGitHubAccountMutationOptions } from "../account-queries";

interface GithubAccountCompleteClientProps {
  returnTo?: string;
}

const DEFAULT_RETURN_TO = "/account/tasks/github";

function normalizeReturnTo(returnTo: string | undefined): string {
  return normalizeGitHubUserAccountReturnTo(returnTo) ?? DEFAULT_RETURN_TO;
}

export function GithubAccountCompleteClient({
  returnTo,
}: GithubAccountCompleteClientProps) {
  const [failed, setFailed] = useState(false);
  const hasStartedRef = useRef(false);

  const syncMutation = useMutation(syncGitHubAccountMutationOptions());
  const { mutateAsync } = syncMutation;

  const finish = useCallback(async () => {
    setFailed(false);

    try {
      const result = await mutateAsync();
      if (!result.account) {
        setFailed(true);
        return;
      }

      window.location.replace(normalizeReturnTo(returnTo));
    } catch {
      setFailed(true);
    }
  }, [mutateAsync, returnTo]);

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;
    void finish();
  }, [finish]);

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 pb-32">
      <div className="w-full max-w-md space-y-4">
        <h1 className="font-medium font-pp text-2xl text-foreground">
          Finishing GitHub connection...
        </h1>
        <p className="text-muted-foreground text-sm">
          Lightfast is checking your GitHub account connection.
        </p>
        {failed ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              The connection is not ready yet. Try syncing it again.
            </p>
            <Button className="w-full" onClick={() => void finish()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Syncing GitHub account
          </div>
        )}
      </div>
    </div>
  );
}
