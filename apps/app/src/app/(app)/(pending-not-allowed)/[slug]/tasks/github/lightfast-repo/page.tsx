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
  if (gate.nextSetupRequirement === "github_org") {
    redirect(`/${slug}/tasks/bind` as Route);
  }

  const sourceControl = await queryClient.fetchQuery(
    trpc.org.settings.sourceControl.get.queryOptions()
  );
  const accountLogin = sourceControl.binding?.accountLogin;
  if (!accountLogin) {
    redirect(`/${slug}/tasks/bind` as Route);
  }

  return (
    <LightfastRepoSetupClient accountLogin={accountLogin} orgSlug={slug} />
  );
}
