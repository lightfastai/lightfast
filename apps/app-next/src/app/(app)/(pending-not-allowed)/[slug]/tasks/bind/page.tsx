import { pathForSetupRequirement } from "@repo/app-setup-contract";
import { githubBindErrorCodeSchema } from "@repo/github-app-contract";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getQueryClient, trpc } from "~/trpc/server";
import { BindGithubCard } from "./_components/bind-github-card";

interface BindTaskPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ github_error?: string | string[] }>;
}

/**
 * v1 org setup page — reachable before the org is bound.
 *
 * It sits under the task layout so setup does not render the workspace sidebar.
 * The proxy allows this route through for unbound orgs; a bound org that lands
 * here is sent through the completion page so a stale Clerk session claim can
 * be refreshed before the workspace gate runs again. Membership/slug access is
 * already enforced by the parent `[slug]/layout.tsx`.
 */
export default async function BindTaskPage({
  params,
  searchParams,
}: BindTaskPageProps) {
  const { slug } = await params;
  const { github_error: githubErrorParam } = await searchParams;
  const gate = await getQueryClient().fetchQuery(
    trpc.viewer.organization.getBySlug.queryOptions({ slug })
  );

  const parsedError = githubBindErrorCodeSchema.safeParse(
    Array.isArray(githubErrorParam) ? githubErrorParam[0] : githubErrorParam
  );

  if (gate.bindingStatus === "bound") {
    redirect(`/${slug}/tasks/bind/github/complete` as Route);
  }

  if (parsedError.success) {
    return <BindGithubCard githubError={parsedError.data} orgSlug={slug} />;
  }

  if (gate.nextSetupRequirement && gate.nextSetupRequirement !== "github_org") {
    redirect(
      pathForSetupRequirement({
        orgSlug: slug,
        requirement: gate.nextSetupRequirement,
      }) as Route
    );
  }

  return <BindGithubCard orgSlug={slug} />;
}
