import { HydrateClient, orgTrpc, prefetch } from "@repo/app-trpc/server";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { auth } from "@vendor/clerk/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WorkspaceGeneralSettingsClient } from "./_components/workspace-general-settings-client";

export default async function WorkspaceSettingsPage({
  params,
}: {
  params: Promise<{ slug: string; workspaceName: string }>;
}) {
  // Parent org layout handles membership; settings layout handles admin role
  const { slug, workspaceName } = await params;
  const { orgId } = await auth();

  if (!orgId) {
    notFound();
  }

  // Prefetch workspace details for instant loading
  // CRITICAL: This must happen BEFORE HydrateClient wrapping
  prefetch(
    orgTrpc.workspace.getByName.queryOptions({
      clerkOrgSlug: slug,
      workspaceName,
    })
  );

  return (
    <HydrateClient>
      <Suspense fallback={<WorkspaceGeneralSettingsSkeleton />}>
        <WorkspaceGeneralSettingsClient
          slug={slug}
          workspaceName={workspaceName}
        />
      </Suspense>
    </HydrateClient>
  );
}

function WorkspaceGeneralSettingsSkeleton() {
  return (
    <div className="space-y-8">
      {/* Workspace Name Section */}
      <div className="space-y-4">
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <div className="w-full space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-4 w-56" />
          <div className="flex justify-end">
            <Skeleton className="h-9 w-16" />
          </div>
        </div>
      </div>

      {/* Workspace Slug Section */}
      <div className="space-y-4">
        <div>
          <Skeleton className="h-7 w-40" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
