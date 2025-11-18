import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prefetch, trpc, HydrateClient } from "@repo/console-trpc/server";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { OrgPageErrorBoundary } from "~/components/errors/org-page-error-boundary";
import { requireOrgAccess } from "~/lib/org-access-clerk";

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

/**
 * Organization layout - handles auth and prefetches org data once for all child pages
 *
 * This layout eliminates redundant auth checks and DB queries on every page by:
 * 1. Using middleware's organizationSyncOptions (sets orgId from URL)
 * 2. Prefetching org data once in layout (not per page)
 * 3. Child pages use prefetched data via useOrgAccess hook
 *
 * Performance: Saves ~70ms per page by eliminating redundant auth() + DB calls
 */
export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { slug } = await params;
  // Verify access once at the layout level. Middleware already enforces sign-in
  // and syncs the active organization from the URL; this ensures the slug
  // actually belongs to the signed-in user and avoids duplicating checks in pages.
  let orgId: string;
  try {
    const { org } = await requireOrgAccess(slug);
    orgId = org.id; // Console org.id is the Clerk org ID
  } catch {
    notFound();
  }

  // Prefetch organization data by Clerk org ID for all children
  prefetch(
    trpc.organization.findByClerkOrgId.queryOptions({
      clerkOrgId: orgId,
    }),
  );

  // Optionally also prefetch by slug for components that reference it directly
  prefetch(
    trpc.organization.findByClerkOrgSlug.queryOptions({
      clerkOrgSlug: slug,
    }),
  );

  return (
    <HydrateClient>
      <OrgPageErrorBoundary orgSlug={slug}>
        <Suspense fallback={<OrgLayoutSkeleton />}>{children}</Suspense>
      </OrgPageErrorBoundary>
    </HydrateClient>
  );
}

function OrgLayoutSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Skeleton className="h-32 w-96" />
    </div>
  );
}
