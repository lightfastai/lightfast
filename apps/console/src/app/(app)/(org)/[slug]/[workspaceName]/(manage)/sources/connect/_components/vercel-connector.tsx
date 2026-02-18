"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import { IntegrationIcons } from "@repo/ui/integration-icons";
import { Check, ExternalLink } from "lucide-react";
import { useConnectForm } from "./connect-form-provider";
import { VercelProjectSelector } from "~/components/integrations/vercel-project-selector";

interface VercelConnectorProps {
  autoOpen?: boolean;
}

export function VercelConnector({ autoOpen = false }: VercelConnectorProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const {
    clerkOrgSlug,
    workspaceName,
    workspaceId,
    setWorkspaceId,
    setUserSourceId,
  } = useConnectForm();

  const [showProjectSelector, setShowProjectSelector] = useState(false);

  // Fetch Vercel connection status (prefetched on server)
  const { data: vercelSource, refetch } = useSuspenseQuery({
    ...trpc.userSources.vercel.get.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Fetch workspace to get ID
  const { data: workspace } = useSuspenseQuery({
    ...trpc.workspace.getByName.queryOptions({
      clerkOrgSlug,
      workspaceName,
    }),
  });

  const isConnected = !!vercelSource?.id;

  useEffect(() => {
    setUserSourceId(vercelSource?.id ?? null);
  }, [vercelSource?.id, setUserSourceId]);

  // Set workspace ID in context
  useEffect(() => {
    if (workspace.id) {
      setWorkspaceId(workspace.id);
    }
  }, [workspace.id, setWorkspaceId]);

  // Auto-open project selector after OAuth return
  useEffect(() => {
    if (autoOpen && isConnected) {
      setShowProjectSelector(true);
    }
  }, [autoOpen, isConnected]);

  const handleConnectVercel = () => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const currentPath = `/${clerkOrgSlug}/${workspaceName}/sources/connect?provider=vercel&connected=true`;
    const popup = window.open(
      `/api/vercel/authorize?redirect=${encodeURIComponent(currentPath)}`,
      "vercel-authorize",
      `width=${width},height=${height},left=${left},top=${top},popup=1`
    );

    // Poll for popup close
    const pollTimer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(pollTimer);
        void refetch();
      }
    }, 500);
  };

  if (!isConnected) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
        <IntegrationIcons.vercel className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground mb-4">
          Connect your Vercel account to select projects
        </p>
        <Button onClick={handleConnectVercel}>
          <IntegrationIcons.vercel className="h-4 w-4 mr-2" />
          Connect Vercel
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connected Status */}
      <div className="flex items-center gap-2 text-sm text-green-600">
        <Check className="h-4 w-4" />
        <span>
          Connected to Vercel
          {vercelSource.teamSlug && ` (${vercelSource.teamSlug})`}
        </span>
      </div>

      {/* Select Projects Button */}
      <Button
        variant="outline"
        onClick={() => setShowProjectSelector(true)}
        className="w-full"
      >
        Select Projects
        <ExternalLink className="h-4 w-4 ml-2" />
      </Button>

      {/* Project Selector Modal */}
      {workspaceId && (
        <VercelProjectSelector
          open={showProjectSelector}
          onOpenChange={setShowProjectSelector}
          userSourceId={vercelSource.id}
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          onSuccess={() => {
            router.push(`/${clerkOrgSlug}/${workspaceName}/sources`);
          }}
        />
      )}
    </div>
  );
}
