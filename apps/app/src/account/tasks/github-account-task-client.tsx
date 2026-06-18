import type { GitHubUserAccountBindErrorCode } from "@repo/github-app-contract";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckmarkCircle02Icon as CheckCircle2,
  Loading03Icon as Loader2,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRef, useState } from "react";
import { TeamSwitcherSlot } from "~/components/team-switcher";
import {
  githubAccountStatusQueryOptions,
  startGitHubAccountBindingMutationOptions,
} from "../account-queries";

interface GithubAccountTaskClientProps {
  githubError?: GitHubUserAccountBindErrorCode;
}

const GITHUB_USER_ACCOUNT_ERROR_MESSAGES: Record<
  GitHubUserAccountBindErrorCode,
  string
> = {
  expired_state: "The GitHub connection expired. Start the connection again.",
  github_account_already_bound:
    "That GitHub account is already connected to another Lightfast user.",
  github_authorization_denied:
    "GitHub authorization was cancelled. Start the connection again when you are ready.",
  github_transient_error:
    "GitHub could not finish the connection. Try again in a moment.",
  github_user_not_verified:
    "Lightfast could not verify that GitHub user account.",
  lightfast_user_already_bound:
    "Your Lightfast account is already connected to a GitHub account.",
  missing_refresh_token:
    "GitHub did not return a refreshable account token. Start the connection again.",
  permission_required:
    "You need to be signed in to connect your GitHub account.",
};

export function GithubAccountTaskClient({
  githubError,
}: GithubAccountTaskClientProps) {
  const { data } = useQuery(githubAccountStatusQueryOptions());

  const startMutation = useMutation(startGitHubAccountBindingMutationOptions());
  const [isStarting, setIsStarting] = useState(false);
  const isStartingRef = useRef(false);
  const isConnecting = startMutation.isPending || isStarting;

  async function handleConnect() {
    if (isStartingRef.current || startMutation.isPending) {
      return;
    }

    isStartingRef.current = true;
    setIsStarting(true);

    try {
      const result = await startMutation.mutateAsync({
        returnTo: "/account/tasks/github",
      });
      window.location.assign(result.authorizationUrl);
    } catch {
      isStartingRef.current = false;
      setIsStarting(false);
      // Surfaced to the user by the useMutation meta.errorTitle handler.
    }
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 pb-32">
      <div className="w-full max-w-md space-y-4">
        <TeamSwitcherSlot />
        <div className="w-fit rounded-sm bg-card p-3">
          <Icons.logoShort className="h-5 w-5 text-foreground" />
        </div>

        <div className="space-y-4">
          <h1 className="pb-4 font-medium font-pp text-2xl text-foreground">
            Connect your GitHub account
          </h1>

          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Link your personal GitHub identity so Lightfast can use user-level
              source-control access when a workflow needs it.
            </p>

            {githubError ? (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm"
                role="alert"
              >
                {GITHUB_USER_ACCOUNT_ERROR_MESSAGES[githubError]}
              </div>
            ) : null}

            {data?.account ? (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-3 text-sm">
                  <HugeiconsIcon icon={CheckCircle2}
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-foreground"
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      GitHub account connected
                    </p>
                    <p className="truncate font-mono text-muted-foreground">
                      {data.account.provider}:{data.account.providerUserId}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <Button
              className="w-full"
              disabled={isConnecting}
              onClick={() => void handleConnect()}
            >
              {isConnecting ? (
                <>
                  <HugeiconsIcon icon={Loader2} className="mr-1.5 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Icons.github aria-hidden="true" className="h-4 w-4" />
                  Connect GitHub account
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
