"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { toast } from "@repo/ui/components/ui/sonner";
import { IntegrationIcons } from "@repo/ui/integration-icons";
import { Check, ExternalLink } from "lucide-react";
import { useConnectForm } from "./connect-form-provider";
import { GitHubRepoSelector } from "~/components/integrations/github-repo-selector";

interface GitHubConnectorProps {
  autoOpen?: boolean;
}

export function GitHubConnector({ autoOpen = false }: GitHubConnectorProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const {
    setSelectedInstallationId,
    selectedInstallationId,
    clerkOrgSlug,
    workspaceName,
    setSelectedResources,
  } = useConnectForm();

  // Fetch GitHub connection status (prefetched on server)
  const { data: githubSource, refetch } = useSuspenseQuery({
    ...trpc.connections.github.get.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const isConnected = !!githubSource?.id;
  const installations = githubSource?.installations ?? [];

  const [showRepoSelector, setShowRepoSelector] = useState(
    () => autoOpen && isConnected && installations.length > 0,
  );

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  const handleConnectGitHub = useCallback(async () => {
    try {
      const data = await queryClient.fetchQuery(
        trpc.connections.getAuthorizeUrl.queryOptions({ provider: "github" }),
      );

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        data.url,
        "github-install",
        `width=${width},height=${height},left=${left},top=${top},popup=1`
      );

      // Clear any existing poll before starting a new one
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }

      // Poll for popup close
      pollTimerRef.current = setInterval(() => {
        if (popup?.closed) {
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          void refetch();
        }
      }, 500);
    } catch (error) {
      toast.error("Failed to connect to GitHub. Please try again.");
    }
  }, [queryClient, trpc, refetch]);

  if (!isConnected) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
        <IntegrationIcons.github className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground mb-4">
          Connect your GitHub account to select repositories
        </p>
        <Button onClick={handleConnectGitHub}>
          <IntegrationIcons.github className="h-4 w-4 mr-2" />
          Connect GitHub
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connected Status */}
      <div className="flex items-center gap-2 text-sm text-green-600">
        <Check className="h-4 w-4" />
        <span>Connected to GitHub</span>
      </div>

      {/* Installation Selector */}
      {installations.length > 1 && (
        <div className="space-y-2">
          <label htmlFor="github-installation-select" className="text-sm font-medium">GitHub Installation</label>
          <Select
            value={selectedInstallationId ?? undefined}
            onValueChange={setSelectedInstallationId}
          >
            <SelectTrigger id="github-installation-select" className="w-full">
              <SelectValue placeholder="Select installation" />
            </SelectTrigger>
            <SelectContent>
              {installations.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>
                  <div className="flex items-center gap-2">
                    <Image
                      src={inst.avatarUrl}
                      alt=""
                      width={16}
                      height={16}
                      className="rounded"
                    />
                    <span>{inst.accountLogin}</span>
                    <span className="text-xs text-muted-foreground">
                      ({inst.accountType})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {installations.length === 1 && installations[0] && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Image
            src={installations[0].avatarUrl}
            alt=""
            width={20}
            height={20}
            className="rounded"
          />
          <span>{installations[0].accountLogin}</span>
        </div>
      )}

      {installations.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <p>
            No GitHub App installations found.{" "}
            <button
              onClick={handleConnectGitHub}
              className="underline hover:no-underline"
            >
              Install the GitHub App
            </button>{" "}
            to access your repositories.
          </p>
        </div>
      )}

      {/* Select Repos Button */}
      {selectedInstallationId && (
        <Button
          variant="outline"
          onClick={() => setShowRepoSelector(true)}
          className="w-full"
        >
          Select Repositories
          <ExternalLink className="h-4 w-4 ml-2" />
        </Button>
      )}

      {/* Repo Selector Modal */}
      {selectedInstallationId && (
        <GitHubRepoSelector
          open={showRepoSelector}
          onOpenChange={setShowRepoSelector}
          gwInstallationId={githubSource.id}
          installationId={selectedInstallationId}
          clerkOrgSlug={clerkOrgSlug}
          workspaceName={workspaceName}
          onSelect={(repos: { id: string; name: string; fullName: string }[]) => {
            setSelectedResources(
              repos.map((r) => ({
                id: r.id,
                name: r.name,
                fullName: r.fullName,
              }))
            );
          }}
        />
      )}
    </div>
  );
}
