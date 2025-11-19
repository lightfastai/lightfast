"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Github, GitlabIcon as GitLab, Search } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { useTRPC } from "@repo/console-trpc/react";
import { useQuery, useMutation } from "@tanstack/react-query";

/**
 * New Project Page
 *
 * Two-state page:
 * 1. Disconnected: Shows Git provider selector
 * 2. Connected: Shows repository picker with org dropdown and search
 *
 * OAuth flow happens in popup window for better UX
 *
 * Data flow:
 * - After OAuth, integration data is stored in database
 * - This page fetches from database using tRPC (no GitHub API calls)
 * - Auto-validates installations if lastSyncAt > 24h old
 */

type ConnectionState = "disconnected" | "connecting" | "connected" | "loading";

interface GitHubInstallation {
  id: string;
  accountId: string;
  accountLogin: string;
  accountType: "User" | "Organization";
  avatarUrl: string;
  permissions: Record<string, string>;
  installedAt: string;
  lastValidatedAt: string;
}

interface Repository {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  defaultBranch: string;
  isPrivate: boolean;
  isArchived: boolean;
  url: string;
  language: string | null;
  stargazersCount: number;
  updatedAt: string;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default function NewProjectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const teamSlug = searchParams.get("teamSlug");
  const trpc = useTRPC();

  const [connectionState, setConnectionState] =
    useState<ConnectionState>("loading");
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [selectedInstallation, setSelectedInstallation] = useState<GitHubInstallation | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [integrationId, setIntegrationId] = useState<string | null>(null);

  // Fetch GitHub integration from database
  const { data: integration, isLoading: isLoadingIntegration, refetch: refetchIntegration } = useQuery({
    ...trpc.integration.github.list.queryOptions(),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Validate installations mutation (calls GitHub API to refresh)
  const validateMutation = useMutation(
    trpc.integration.github.validate.mutationOptions({
      onSuccess: () => {
        // Refetch integration after validation
        void refetchIntegration();
      },
    })
  );

  // Fetch repositories for selected installation
  const { data: repositoriesData, isLoading: isLoadingRepos } = useQuery({
    ...trpc.integration.github.repositories.queryOptions({
      integrationId: integrationId ?? "",
      installationId: selectedInstallation?.id ?? "",
    }),
    enabled: Boolean(integrationId && selectedInstallation),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Update repositories when data changes
  useEffect(() => {
    if (repositoriesData) {
      setRepositories(repositoriesData);
    }
  }, [repositoriesData]);

  // Check for setup callback on mount
  useEffect(() => {
    const setupStatus = searchParams.get("setup");
    const installationIdFromSetup = searchParams.get("installation_id");

    if (setupStatus === "success" && installationIdFromSetup) {
      // User just installed the app - refetch integration
      void refetchIntegration();
    }
  }, [searchParams, refetchIntegration]);

  // Listen for OAuth success message from popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "github-oauth-success") {
        setConnectionState("connected");
        void refetchIntegration();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [refetchIntegration]);

  // Process integration data when it loads
  useEffect(() => {
    if (isLoadingIntegration) {
      setConnectionState("loading");
      return;
    }

    if (!integration) {
      setConnectionState("disconnected");
      setInstallations([]);
      setIntegrationId(null);
      return;
    }

    // Store integration ID
    setIntegrationId(integration.id);

    // Extract installations from database
    const installs = integration.installations ?? [];
    setInstallations(installs);

    if (installs.length === 0) {
      setConnectionState("disconnected");
      return;
    }

    setConnectionState("connected");

    // Auto-select first installation if none selected
    if (!selectedInstallation && installs.length > 0) {
      setSelectedInstallation(installs[0]!);
    }

    // Auto-validate if lastSyncAt is > 24 hours old
    if (integration.isActive && integration.connectedAt) {
      const lastSync = integration.connectedAt;
      const timeSinceSync = Date.now() - new Date(lastSync).getTime();

      if (timeSinceSync > ONE_DAY_MS && !validateMutation.isPending) {
        console.log("[NewProjectPage] Auto-validating installations (>24h old)");
        validateMutation.mutate();
      }
    }
  }, [integration, isLoadingIntegration, selectedInstallation, validateMutation]);

  // Handle org selection change
  const handleOrgChange = (accountLogin: string) => {
    const installation = installations.find(
      (inst) => inst.accountLogin === accountLogin,
    );
    if (installation) {
      setSelectedInstallation(installation);
    }
  };

  // Handle GitHub OAuth to list installations
  const handleConnectGitHub = () => {
    setConnectionState("connecting");

    const width = 600;
    const height = 800;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    // Open GitHub OAuth flow in popup
    // OAuth callback stores integration in database
    const popup = window.open(
      "/api/github/auth",
      "github-oauth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`,
    );

    // Fallback: Check if popup was blocked
    if (!popup || popup.closed) {
      alert("Popup was blocked. Please allow popups for this site.");
      setConnectionState("disconnected");
      return;
    }

    // Poll for popup close to refetch integration
    const pollTimer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(pollTimer);
        // Refetch integration after OAuth completes
        void refetchIntegration();
      }
    }, 500);
  };

  // Handle installing GitHub App (for users who don't have it installed yet)
  const handleInstallApp = () => {
    // Direct navigation to GitHub App installation page
    // The Setup URL will redirect back to /new?setup=success&installation_id=XXX
    window.location.href = "https://github.com/apps/lightfastai-dev/installations/new";
  };

  // Handle repository import - redirect to configuration page
  const handleImport = (repo: Repository) => {
    if (!selectedInstallation) {
      console.error("No installation selected");
      return;
    }

    // Build query params similar to Vercel
    const params = new URLSearchParams({
      id: repo.id,
      name: repo.name,
      owner: repo.owner,
      provider: "github",
      installationId: selectedInstallation.id,
      teamSlug: teamSlug || selectedInstallation.accountLogin,
      "project-name": repo.name,
      s: repo.url,
    });

    // Redirect to import configuration page
    router.push(`/new/import?${params.toString()}`);
  };

  // Handle adjusting GitHub App permissions in popup
  const handleAdjustPermissions = () => {
    const width = 600;
    const height = 800;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    const popup = window.open(
      "https://github.com/apps/lightfastai-dev/installations/select_target",
      "github-permissions",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`,
    );

    // Poll for popup close to refresh installations
    const pollTimer = setInterval(() => {
      if (popup?.closed) {
        clearInterval(pollTimer);
        // Validate and refresh installations after user updates permissions
        validateMutation.mutate();
      }
    }, 500);
  };

  // Filter repositories by search query
  const filteredRepositories = repositories.filter((repo) =>
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 30) return `${diffDays}d ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16">
        {/* Loading State */}
        {connectionState === "loading" && (
          <div className="mx-auto max-w-xl text-center">
            <h1 className="mb-12 text-4xl font-bold tracking-tight">
              Let's build something new
            </h1>
            <p className="text-muted-foreground">Loading integrations...</p>
          </div>
        )}

        {/* Disconnected State: Git Provider Selector */}
        {connectionState === "disconnected" && (
          <div className="mx-auto max-w-xl">
            <h1 className="mb-12 text-center text-4xl font-bold tracking-tight">
              Let's build something new
            </h1>

            <div className="space-y-6">
              <div>
                <h2 className="mb-2 text-2xl font-semibold">
                  Import Git Repository
                </h2>
                <p className="mb-6 text-muted-foreground">
                  Select a Git provider to import an existing project from a Git
                  Repository.
                </p>
              </div>

              <div className="space-y-3">
                {/* GitHub - Active */}
                <Button
                  onClick={handleConnectGitHub}
                  className="w-full justify-center gap-3 bg-[#24292e] text-white hover:bg-[#1a1e22] text-base font-medium"
                  size="xl"
                >
                  <Github className="h-5 w-5" />
                  Continue with GitHub
                </Button>

                {/* GitLab - Disabled */}
                <Button
                  disabled
                  className="w-full justify-center gap-3 bg-[#6e49cb] text-white opacity-40 text-base font-medium"
                  size="xl"
                >
                  <GitLab className="h-5 w-5" />
                  Continue with GitLab
                </Button>

                {/* Bitbucket - Disabled */}
                <Button
                  disabled
                  className="w-full justify-center gap-3 bg-[#0052cc] text-white opacity-40 text-base font-medium"
                  size="xl"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z" />
                  </svg>
                  Continue with Bitbucket
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Connecting State: Loading */}
        {connectionState === "connecting" && (
          <div className="mx-auto max-w-xl text-center">
            <h1 className="mb-12 text-5xl font-bold tracking-tight">
              Let's build something new
            </h1>
            <p className="text-muted-foreground">Connecting to GitHub...</p>
          </div>
        )}

        {/* Connected State: Repository Picker */}
        {connectionState === "connected" && (
          <div className="mx-auto max-w-4xl">
            <h1 className="mb-8 text-4xl font-bold">Import Git Repository</h1>

            {/* Org Selector & Search */}
            <div className="mb-6 flex gap-4 items-center">
              <Select
                value={selectedInstallation?.accountLogin}
                onValueChange={handleOrgChange}
              >
                <SelectTrigger className="w-[300px]">
                  <div className="flex items-center gap-2">
                    <Github className="h-5 w-5" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {installations.map((installation) => (
                    <SelectItem
                      key={installation.id}
                      value={installation.accountLogin}
                    >
                      {installation.accountLogin}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Repository List */}
            <div className="rounded-lg border bg-card overflow-hidden">
              {isLoadingRepos ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading repositories...
                </div>
              ) : filteredRepositories.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-muted-foreground mb-4">
                    {searchQuery
                      ? "No repositories match your search"
                      : "No repositories found"}
                  </p>
                  {!searchQuery && (
                    <p className="text-sm text-muted-foreground">
                      Make sure the GitHub App has access to your repositories.{" "}
                      <button
                        onClick={handleAdjustPermissions}
                        className="text-blue-500 hover:text-blue-600 underline"
                      >
                        Adjust permissions
                      </button>
                    </p>
                  )}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredRepositories.map((repo) => (
                    <div
                      key={repo.id}
                      className="flex items-center justify-between p-4 hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          <svg
                            className="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{repo.name}</span>
                            {repo.isPrivate && (
                              <span className="text-xs text-muted-foreground border px-2 py-0.5 rounded">
                                Private
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatRelativeTime(repo.updatedAt)}
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleImport(repo)}
                        variant="outline"
                      >
                        Import
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Missing Repository Link */}
            <div className="mt-4 text-center text-sm text-muted-foreground">
              Missing Git repository?{" "}
              <button
                onClick={handleAdjustPermissions}
                className="text-blue-500 hover:text-blue-600 underline-offset-4 hover:underline transition-colors"
              >
                Adjust GitHub App Permissions →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
