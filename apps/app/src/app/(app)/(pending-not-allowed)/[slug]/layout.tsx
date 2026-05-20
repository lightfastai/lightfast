import { getQueryClient, HydrateClient, trpc } from "@repo/app-trpc/server";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { notFound } from "next/navigation";
import { OrgPageErrorBoundary } from "~/components/errors/org-page-error-boundary";

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

/**
 * Why we check access by slug through tRPC instead of auth().orgSlug:
 * after org name changes, setActive() updates cookies but there can be
 * propagation delay. The API layer resolves the org from the user's Clerk
 * memberships by slug and verifies access there.
 */
export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { slug } = await params;

  try {
    await getQueryClient().fetchQuery(
      trpc.pendingAllowed.organization.getBySlug.queryOptions({ slug })
    );
  } catch (error) {
    log.debug("[org-layout] access denied", { slug, error: parseError(error) });
    notFound();
  }

  return (
    <HydrateClient>
      <OrgPageErrorBoundary orgSlug={slug}>{children}</OrgPageErrorBoundary>
    </HydrateClient>
  );
}
