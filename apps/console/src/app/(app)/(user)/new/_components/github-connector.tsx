"use client";

import { useEffect, useRef } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { Github } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { useTRPC } from "@repo/console-trpc/react";
import { useWorkspaceForm } from "./workspace-form-provider";
import { RepositoryPicker } from "./repository-picker";

/**
 * GitHub Connector
 * Client island for GitHub App installation management
 *
 * Uses useSuspenseQuery with prefetched data from parent RSC.
 * Prevents client-side fetch waterfall and improves perceived performance.
 */
export function GitHubConnector() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const {
    installationId,
    setInstallationId,
    setInstallations,
    selectedInstallation,
    setSelectedInstallation,
  } = useWorkspaceForm();

  // Fetch GitHub user source (prefetched in parent RSC)
  // Use user router endpoint (not org router) to support pending users
  const { data: githubUserSource, refetch: refetchIntegration } =
    useSuspenseQuery({
      ...trpc.connections.github.get.queryOptions(),
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    });

  // React Compiler handles memoization automatically
  const installations = githubUserSource?.installations ?? [];

  // Track previous installations for equality comparison
  const prevInstallationsRef = useRef<typeof installations>([]);

  // Effect 1: Sync installationId to context (only when ID value changes, not object reference)
  useEffect(() => {
    const id = githubUserSource?.id ?? null;
    setInstallationId(id);
  }, [githubUserSource?.id, setInstallationId]);

  // Effect 2: Sync installations array to context (with ID equality check)
  useEffect(() => {
    const prevIds = prevInstallationsRef.current.map((i) => i.id).join(",");
    const newIds = installations.map((i) => i.id).join(",");

    if (prevIds !== newIds) {
      setInstallations(installations);
      prevInstallationsRef.current = installations;
    }
  }, [installations, setInstallations]);

  // Effect 3: Handle installation selection with proper reset logic
  // - Initial mount: Select first installation if none selected
  // - Reconnection: Validate current selection still exists, reset to first if not
  // - No installations: Clear selection
  useEffect(() => {
    if (installations.length === 0) {
      // No installations available, clear selection
      if (selectedInstallation !== null) {
        setSelectedInstallation(null);
      }
      return;
    }

    // Check if current selection still exists
    const currentSelectionStillExists = selectedInstallation
      ? installations.some((inst) => inst.id === selectedInstallation.id)
      : false;

    if (currentSelectionStillExists) {
      // Selection is valid, no update needed
      return;
    }

    // Need to select first installation
    const firstInstall = installations[0];
    if (firstInstall) {
      // Only update if we're selecting a DIFFERENT installation
      if (selectedInstallation?.id !== firstInstall.id) {
        setSelectedInstallation(firstInstall);
      }
    }
  }, [installations, selectedInstallation, setSelectedInstallation]);

  // Handle GitHub App installation in popup
  const handleConnectGitHub = async () => {
    try {
      const data = await queryClient.fetchQuery(
        trpc.connections.getAuthorizeUrl.queryOptions({ provider: "github" }),
      );

      const width = 600;
      const height = 800;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        data.url,
        "github-install",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`,
      );

      if (!popup || popup.closed) {
        alert("Popup was blocked. Please allow popups for this site.");
        return;
      }

      // Poll for popup close to refetch integration
      const pollTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollTimer);
          void refetchIntegration();
        }
      }, 500);
    } catch {
      // Failed to get authorize URL
    }
  };

  const hasGitHubConnection = Boolean(
    githubUserSource && installations.length > 0,
  );

  if (!hasGitHubConnection) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <Github className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-sm text-muted-foreground mb-4">
          Connect GitHub to select a repository
        </p>
        <Button onClick={handleConnectGitHub}>
          <Github className="h-5 w-5 mr-2" />
          Connect GitHub
        </Button>
      </div>
    );
  }

  return (
    <RepositoryPicker
      installationId={installationId}
      refetchIntegration={refetchIntegration}
    />
  );
}
