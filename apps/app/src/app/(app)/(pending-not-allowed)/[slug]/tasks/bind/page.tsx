import type { Route } from "next";
import { redirect } from "next/navigation";
import { requireOrgAccess } from "~/lib/org-access-clerk";
import { getOrgBindingGate } from "~/lib/org-binding-gate";
import { BindGithubCard } from "./_components/bind-github-card";

interface BindTaskPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * v1 org setup page — reachable before the org is bound.
 *
 * It sits outside the `(bound)` route group so its own gate never redirects to
 * itself; a bound org that lands here is sent back to the workspace root.
 * Membership/slug access is already enforced by the parent `[slug]/layout.tsx`.
 */
export default async function BindTaskPage({ params }: BindTaskPageProps) {
  const { slug } = await params;
  const { org } = await requireOrgAccess(slug);
  const gate = await getOrgBindingGate(org.id);

  if (gate.bindingStatus === "bound") {
    redirect(`/${slug}` as Route);
  }

  return <BindGithubCard orgSlug={slug} />;
}
