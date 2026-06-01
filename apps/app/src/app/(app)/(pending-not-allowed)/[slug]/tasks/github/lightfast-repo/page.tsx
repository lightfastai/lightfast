import { pathForSetupRequirement } from "@repo/app-setup-contract";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getQueryClient, trpc } from "~/trpc/server";
import { LightfastRepoSetupClient } from "./_components/lightfast-repo-setup-client";

interface LightfastRepoSetupPageProps {
  params: Promise<{ slug: string }>;
}

export default async function LightfastRepoSetupPage({
  params,
}: LightfastRepoSetupPageProps) {
  const { slug } = await params;
  const queryClient = getQueryClient();
  const gate = await queryClient.fetchQuery(
    trpc.viewer.organization.getBySlug.queryOptions({ slug })
  );

  if (gate.bindingStatus === "bound") {
    redirect(`/${slug}/tasks/bind/github/complete` as Route);
  }
  if (
    gate.nextSetupRequirement &&
    gate.nextSetupRequirement !== "github_lightfast_repo"
  ) {
    redirect(
      pathForSetupRequirement({
        orgSlug: slug,
        requirement: gate.nextSetupRequirement,
      }) as Route
    );
  }

  const sourceControlRepositories = await queryClient.fetchQuery(
    trpc.org.settings.sourceControl.listRepositories.queryOptions()
  );
  const accountLogin = sourceControlRepositories.organization?.login;
  if (!accountLogin) {
    return <GitHubOrgMetadataUnavailable orgSlug={slug} />;
  }

  return (
    <LightfastRepoSetupClient accountLogin={accountLogin} orgSlug={slug} />
  );
}

function GitHubOrgMetadataUnavailable({ orgSlug }: { orgSlug: string }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 pb-32">
      <div className="w-full max-w-md space-y-4">
        <div className="w-fit rounded-sm bg-card p-3">
          <Icons.logoShort className="h-5 w-5 text-foreground" />
        </div>

        <div className="space-y-4">
          <h1 className="pb-4 font-medium font-pp text-2xl text-foreground">
            GitHub organization details could not be refreshed
          </h1>

          <p className="text-muted-foreground text-sm">
            Refresh this page to try again, or return to settings while GitHub
            details are unavailable.
          </p>

          <div className="grid gap-2">
            <Button asChild variant="secondary">
              <Link href={`/${orgSlug}/tasks/github/lightfast-repo` as Route}>
                Retry
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/${orgSlug}/settings` as Route}>Open settings</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
