"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import { IntegrationIcons } from "@repo/ui/integration-icons";
import { Check } from "lucide-react";
import { useConnectForm } from "./connect-form-provider";

interface SentryConnectorProps {
  autoOpen?: boolean;
}

export function SentryConnector({ autoOpen = false }: SentryConnectorProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { clerkOrgSlug, workspaceName } = useConnectForm();

  const { data: sentrySource, refetch } = useSuspenseQuery({
    ...trpc.connections.sentry.get.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const isConnected = !!sentrySource?.id;

  const [connectError, setConnectError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAutoOpened = useRef(false);

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const handleConnectSentry = useCallback(async () => {
    setConnectError(null);

    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    // Open popup synchronously to avoid browser popup blockers
    const popup = window.open(
      "about:blank",
      "sentry-authorize",
      `width=${width},height=${height},left=${left},top=${top},popup=1`,
    );

    if (!popup) {
      setConnectError("Popup was blocked. Please allow popups for this site and try again.");
      return;
    }

    try {
      const data = await queryClient.fetchQuery(
        trpc.connections.getAuthorizeUrl.queryOptions({ provider: "sentry" }),
      );

      popup.location.href = data.url;

      // Poll for popup close
      pollTimerRef.current = setInterval(() => {
        if (popup.closed) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          void refetch();
        }
      }, 500);
    } catch (err) {
      popup.close();
      console.error("Failed to get Sentry authorize URL:", err);
      setConnectError("Failed to start Sentry authorization. Please try again.");
    }
  }, [queryClient, trpc, refetch]);

  // Auto-open OAuth popup on mount if requested and not already connected
  useEffect(() => {
    if (autoOpen && !isConnected && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      void handleConnectSentry();
    }
  }, [autoOpen, isConnected, handleConnectSentry]);

  if (!isConnected) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
        <IntegrationIcons.sentry className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground mb-4">
          Connect your Sentry account to receive error tracking events
        </p>
        <Button onClick={handleConnectSentry}>
          <IntegrationIcons.sentry className="h-4 w-4 mr-2" />
          Connect Sentry
        </Button>
        {connectError && (
          <p className="text-sm text-destructive mt-2">{connectError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-green-600">
        <Check className="h-4 w-4" />
        <span>Connected to Sentry</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Sentry events will be automatically synced to your workspace.
      </p>
      <Button
        variant="outline"
        onClick={() => router.push(`/${clerkOrgSlug}/${workspaceName}/sources`)}
      >
        Go to Sources
      </Button>
    </div>
  );
}
