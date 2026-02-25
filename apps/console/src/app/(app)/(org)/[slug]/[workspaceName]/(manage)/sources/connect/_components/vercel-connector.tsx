"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const {
    clerkOrgSlug,
    workspaceName,
    workspaceId,
  } = useConnectForm();

  // Fetch Vercel connection status (prefetched on server)
  const { data: vercelSource, refetch } = useSuspenseQuery({
    ...trpc.connections.vercel.get.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const isConnected = !!vercelSource?.id;

  // Lazy initializer: on OAuth redirect back, both autoOpen and isConnected are
  // true at mount time (useSuspenseQuery has prefetched data server-side), so we
  // can derive the initial value directly without a synchronous effect.
  const [showProjectSelector, setShowProjectSelector] = useState(() => autoOpen && isConnected);
  const [connectError, setConnectError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const handleConnectVercel = async () => {
    setConnectError(null);

    try {
      const data = await queryClient.fetchQuery(
        trpc.connections.getAuthorizeUrl.queryOptions({ provider: "vercel" }),
      );

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        data.url,
        "vercel-authorize",
        `width=${width},height=${height},left=${left},top=${top},popup=1`
      );

      if (!popup) {
        setConnectError("Popup was blocked. Please allow popups for this site and try again.");
        return;
      }

      // Poll for popup close
      pollTimerRef.current = setInterval(() => {
        if (popup.closed) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          void refetch();
        }
      }, 500);
    } catch (err) {
      console.error("Failed to get Vercel authorize URL:", err);
      setConnectError("Failed to start Vercel authorization. Please try again.");
    }
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
        {connectError && (
          <p className="text-sm text-destructive mt-2">{connectError}</p>
        )}
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
          installationId={vercelSource.id}
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
