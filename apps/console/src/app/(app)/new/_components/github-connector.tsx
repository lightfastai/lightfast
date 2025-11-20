"use client";

import { useEffect } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Github } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { useTRPC } from "@repo/console-trpc/react";
import { useWorkspaceForm } from "./workspace-form-provider";
import { RepositoryPicker } from "./repository-picker";

/**
 * GitHub Connector
 * Client island for GitHub OAuth connection and installation management
 */
export function GitHubConnector() {
  const trpc = useTRPC();
  const {
    integrationId,
    setIntegrationId,
    installations,
    setInstallations,
    selectedInstallation,
    setSelectedInstallation,
  } = useWorkspaceForm();

  // Fetch GitHub integration (prefetched server-side)
  const { data: githubIntegration, refetch: refetchIntegration } = useSuspenseQuery({
    ...trpc.integration.github.list.queryOptions(),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Process integration data
  useEffect(() => {
    if (githubIntegration) {
      setIntegrationId(githubIntegration.id);
      const installs = githubIntegration.installations ?? [];
      setInstallations(installs);
      if (installs.length > 0 && !selectedInstallation) {
        setSelectedInstallation(installs[0]!);
      }
    }
  }, [githubIntegration, selectedInstallation, setIntegrationId, setInstallations, setSelectedInstallation]);

  // Handle GitHub OAuth in popup
  const handleConnectGitHub = () => {
    const width = 600;
    const height = 800;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      "/api/github/install",
      "github-install",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`,
    );

    if (!popup || popup.closed) {
      alert("Popup was blocked. Please allow popups for this site.");
      return;
    }

    // Poll for popup close to refetch integration
    const pollTimer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(pollTimer);
        void refetchIntegration();
      }
    }, 500);
  };

  const hasGitHubConnection = Boolean(githubIntegration && installations.length > 0);

  if (!hasGitHubConnection) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <Github className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-sm text-muted-foreground mb-4">
          Connect GitHub to select a repository
        </p>
        <Button
          onClick={handleConnectGitHub}
          className="bg-[#24292e] text-white hover:bg-[#1a1e22]"
        >
          <Github className="h-5 w-5 mr-2" />
          Connect GitHub
        </Button>
      </div>
    );
  }

  return (
    <RepositoryPicker
      integrationId={integrationId}
      refetchIntegration={refetchIntegration}
    />
  );
}
