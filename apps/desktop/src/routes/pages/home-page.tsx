import { useEffect } from "react";
import { RootLayout } from "@/components/root-layout";
import { trpc } from "@/trpc";
import { prefetchWorkspaceData } from "@/utils/prefetch-utils";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { Skeleton } from "@repo/ui/components/ui/skeleton";

export default function HomePage() {
  const navigate = useNavigate();

  // Query to get all workspaces, sorted by updatedAt (most recent first)
  const { data: workspaces, isLoading } = useQuery(
    trpc.tenant.workspace.getAll.queryOptions(),
  );

  // Prefetch data when workspaces are loaded
  useEffect(() => {
    if (workspaces && workspaces.length > 0) {
      // Prefetch the most recent workspace data
      const mostRecentWorkspace = workspaces[0]; // Already sorted by updatedAt desc
      prefetchWorkspaceData(mostRecentWorkspace.id);
    }
  }, [workspaces]);

  // Automatically redirect to the most recent workspace
  useEffect(() => {
    if (workspaces && workspaces.length > 0) {
      const mostRecentWorkspace = workspaces[0]; // Already sorted by updatedAt desc

      // Navigate to the workspace
      navigate({
        to: "/workspace/$workspaceId",
        params: { workspaceId: mostRecentWorkspace.id },
      });
    }
  }, [workspaces, navigate]);

  // Show a loading state while redirecting
  return (
    <RootLayout>
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold">
            {isLoading ? (
              <>
                <Skeleton className="mx-auto mb-4 h-8 w-40" />
                <div className="text-muted-foreground text-sm">
                  Loading your workspace...
                </div>
              </>
            ) : workspaces && workspaces.length === 0 ? (
              "No workspaces found. Create one to get started."
            ) : (
              "Redirecting to your workspace..."
            )}
          </h1>
        </div>
      </div>
    </RootLayout>
  );
}
