import { getGitHubAppConfig } from "@api/app/services/github";
import {
  LIGHTFAST_REPOSITORY_NAME,
  pathForSetupRequirement,
} from "@repo/app-setup-contract";
import { buildGitHubNewRepositoryUrl } from "@repo/github-app-node";
import type { Route } from "next";
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

  const sourceControl = await queryClient.fetchQuery(
    trpc.org.settings.sourceControl.get.queryOptions()
  );
  const accountLogin = sourceControl.binding?.accountLogin;
  if (!accountLogin) {
    redirect(`/${slug}/tasks/bind` as Route);
  }
  const config = getGitHubAppConfig();
  const newRepositoryUrl = buildGitHubNewRepositoryUrl({
    accountLogin,
    name: LIGHTFAST_REPOSITORY_NAME,
    webBaseUrl: config.endpoints.webBaseUrl,
  });

  return (
    <LightfastRepoSetupClient
      accountLogin={accountLogin}
      newRepositoryUrl={newRepositoryUrl}
      orgSlug={slug}
    />
  );
}
