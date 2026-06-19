import { useSession } from "@clerk/tanstack-react-start";
import {
  ExternalLinkIcon as ExternalLink,
  Loading03Icon as Loader2,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  LIGHTFAST_REPOSITORY_NAME,
  pathForSetupRequirement,
} from "@repo/app-setup-contract";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { TeamSwitcherSlot } from "~/components/team-switcher";
import { verifyGitHubLightfastRepoMutationOptions } from "./github-setup-queries";

interface LightfastRepoSetupClientProps {
  accountLogin: string;
  newRepositoryUrl: string;
  orgSlug: string;
}

export function LightfastRepoSetupClient({
  accountLogin,
  newRepositoryUrl,
  orgSlug,
}: LightfastRepoSetupClientProps) {
  const { session } = useSession();
  const [failed, setFailed] = useState(false);

  const verifyMutation = useMutation(
    verifyGitHubLightfastRepoMutationOptions()
  );

  async function handleVerify() {
    if (verifyMutation.isPending) {
      return;
    }
    setFailed(false);

    try {
      const result = await verifyMutation.mutateAsync();
      await session?.reload();
      if (result.nextSetupRequirement) {
        window.location.replace(
          pathForSetupRequirement({
            orgSlug,
            requirement: result.nextSetupRequirement,
          })
        );
        return;
      }
      window.location.replace(`/${orgSlug}`);
    } catch {
      setFailed(true);
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
          <h1 className="pb-4 font-medium font-title text-2xl text-foreground">
            Create the .lightfast repository
          </h1>

          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Lightfast needs a GitHub repository named{" "}
              <span className="font-mono text-foreground">
                {LIGHTFAST_REPOSITORY_NAME}
              </span>{" "}
              in {accountLogin} before workspace features unlock.
            </p>

            {failed ? (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm"
                role="alert"
              >
                Lightfast could not verify the repository.
              </div>
            ) : null}

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex min-w-0 items-center gap-2 text-muted-foreground text-sm">
                <Icons.github aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="truncate font-mono">
                  {accountLogin}/{LIGHTFAST_REPOSITORY_NAME}
                </span>
              </div>
            </div>

            <div className="grid gap-2">
              <Button asChild variant="secondary">
                <a
                  href={newRepositoryUrl}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  <HugeiconsIcon
                    aria-hidden="true"
                    className="h-4 w-4"
                    icon={ExternalLink}
                  />
                  Open GitHub
                </a>
              </Button>
              <Button
                disabled={verifyMutation.isPending}
                onClick={() => void handleVerify()}
              >
                {verifyMutation.isPending ? (
                  <>
                    <HugeiconsIcon
                      className="mr-1.5 h-4 w-4 animate-spin"
                      icon={Loader2}
                    />
                    Verifying...
                  </>
                ) : (
                  "Verify repository"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
