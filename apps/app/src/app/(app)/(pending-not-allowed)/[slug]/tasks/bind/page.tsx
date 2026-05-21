import { getQueryClient, trpc } from "@repo/app-trpc/server";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { BindGithubCard } from "./_components/bind-github-card";

interface BindTaskPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * v1 org setup page — reachable before the org is bound.
 *
 * It sits under the task layout so setup does not render the workspace sidebar.
 * The proxy allows this route through for unbound orgs; a bound org that lands
 * here is sent back to the workspace root. Membership/slug access is already
 * enforced by the parent `[slug]/layout.tsx`.
 */
export default async function BindTaskPage({ params }: BindTaskPageProps) {
  const { slug } = await params;
  const gate = await getQueryClient().fetchQuery(
    trpc.viewer.organization.getBySlug.queryOptions({ slug })
  );

  if (gate.bindingStatus === "bound") {
    redirect(`/${slug}` as Route);
  }

  return <BindGithubCard orgSlug={slug} />;
}
