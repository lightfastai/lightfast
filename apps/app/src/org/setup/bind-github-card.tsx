import type { GitHubBindErrorCode } from "@repo/github-app-contract";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { startGitHubOrgSetupMutationOptions } from "./github-setup-queries";

interface BindGithubCardProps {
  githubError?: GitHubBindErrorCode;
  orgSlug: string;
}

const GITHUB_ERROR_MESSAGES: Record<GitHubBindErrorCode, string> = {
  expired_state: "The GitHub connection expired. Start the connection again.",
  github_authorization_denied:
    "GitHub authorization was cancelled. Start the connection again when you are ready.",
  github_transient_error:
    "GitHub could not finish the connection. Try again in a moment.",
  installation_already_bound:
    "That GitHub installation is already connected to another Lightfast team.",
  installation_not_verified:
    "Lightfast could not verify that GitHub installation.",
  org_already_bound:
    "This Lightfast team is already connected to a GitHub organization.",
  permission_required:
    "You need to be a Lightfast team admin to connect GitHub.",
  personal_account_not_supported:
    "Connect a GitHub organization instead of a personal account.",
  saml_session_required:
    "Refresh your GitHub organization session, then try again.",
};

export function BindGithubCard({ githubError, orgSlug }: BindGithubCardProps) {
  const bindMutation = useMutation(startGitHubOrgSetupMutationOptions());

  async function handleConnect() {
    if (bindMutation.isPending) {
      return;
    }

    try {
      const result = await bindMutation.mutateAsync({ orgSlug });
      window.location.assign(result.installationUrl);
    } catch {
      // Surfaced by the mutation error toast.
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

            {githubError ? (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm"
                role="alert"
              >
                {GITHUB_ERROR_MESSAGES[githubError]}
              </div>
            ) : null}

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
