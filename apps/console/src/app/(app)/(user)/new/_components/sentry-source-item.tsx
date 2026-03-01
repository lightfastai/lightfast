"use client";

import { useEffect, useRef } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { toast } from "@repo/ui/components/ui/sonner";
import { useTRPC } from "@repo/console-trpc/react";
import { useWorkspaceForm } from "./workspace-form-provider";

function SentryIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 72 66"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M29 2.26a3.68 3.68 0 0 0-6.38 0L1.22 42.09a3.68 3.68 0 0 0 3.19 5.52h7.85a3.68 3.68 0 0 0 3.19-1.84L29 22.18a15.65 15.65 0 0 1 8.29 13.8v5.48h-5.57a3.68 3.68 0 0 0 0 7.36h13.25a3.68 3.68 0 0 0 0-7.36h-.32V36a23 23 0 0 0-12.43-20.46L41 2.26a3.68 3.68 0 0 0-6.38 0l-2.81 4.87a23 23 0 0 0-8.59 8.6L29 2.26z" />
    </svg>
  );
}

/**
 * Sentry accordion item for the Sources section.
 * Fetches its own connection status (prefetched by parent page via sentry.get).
 * Sentry is org-level — no per-resource picker needed, just connect/disconnect.
 */
export function SentrySourceItem() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { setSentryInstallationId } = useWorkspaceForm();

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch Sentry connection (prefetched by parent page RSC)
  const { data: sentryConnection, refetch: refetchConnection } = useSuspenseQuery({
    ...trpc.connections.sentry.get.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const hasConnection = sentryConnection !== null;

  // Sync sentryInstallationId from the connection
  useEffect(() => {
    setSentryInstallationId(sentryConnection?.id ?? null);
  }, [sentryConnection?.id, setSentryInstallationId]);

  // Cleanup poll timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const handleConnect = async () => {
    try {
      const data = await queryClient.fetchQuery(
        trpc.connections.getAuthorizeUrl.queryOptions({ provider: "sentry" }),
      );
      const width = 600;
      const height = 800;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      const popup = window.open(
        data.url,
        "sentry-install",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`,
      );
      if (!popup || popup.closed) {
        alert("Popup was blocked. Please allow popups for this site.");
        return;
      }
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(() => {
        if (popup.closed) {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          void refetchConnection();
        }
      }, 500);
    } catch {
      toast.error("Failed to connect to Sentry. Please try again.");
    }
  };

  return (
    <AccordionItem value="sentry">
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center gap-3 flex-1">
          <SentryIcon className="h-5 w-5 shrink-0" />
          <span className="font-medium">Sentry</span>
          {hasConnection ? (
            <Badge variant="secondary" className="text-xs">Connected</Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">Not connected</Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4">
        {!hasConnection ? (
          <div className="flex flex-col items-center py-6 text-center gap-4">
            <p className="text-sm text-muted-foreground">
              Connect Sentry to monitor errors and performance
            </p>
            <Button onClick={handleConnect} variant="outline">
              <SentryIcon className="h-4 w-4 mr-2" />
              Connect Sentry
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                  <SentryIcon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">Sentry connected</span>
                  <p className="text-sm text-muted-foreground">
                    Error tracking will be linked to this workspace
                  </p>
                </div>
                <Button onClick={handleConnect} variant="outline" size="sm">
                  Reconnect
                </Button>
              </div>
            </div>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
