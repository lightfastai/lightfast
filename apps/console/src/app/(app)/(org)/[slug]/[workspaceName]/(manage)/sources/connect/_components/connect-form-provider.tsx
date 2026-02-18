"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";

interface SelectedResource {
  id: string;
  name: string;
  fullName?: string; // For GitHub repos: "owner/repo"
}

interface ConnectFormContextValue {
  // Provider state
  provider: "github" | "vercel" | "linear" | "sentry";
  setProvider: (provider: "github" | "vercel" | "linear" | "sentry") => void;

  // Connection state (derived from query data)
  userSourceId: string | null;

  // GitHub-specific
  selectedInstallationId: string | null;
  setSelectedInstallationId: (id: string | null) => void;

  // Resource selection
  selectedResources: SelectedResource[];
  setSelectedResources: (resources: SelectedResource[]) => void;

  // Workspace context
  clerkOrgSlug: string;
  workspaceName: string;
  workspaceId: string | null;
}

const ConnectFormContext = createContext<ConnectFormContextValue | null>(null);

export function ConnectFormProvider({
  children,
  initialProvider,
  clerkOrgSlug,
  workspaceName,
}: {
  children: ReactNode;
  initialProvider: "github" | "vercel" | "linear" | "sentry";
  clerkOrgSlug: string;
  workspaceName: string;
}) {
  const trpc = useTRPC();
  const [provider, setProvider] = useState<"github" | "vercel" | "linear" | "sentry">(initialProvider);
  // Explicit user selection; null means "use the first available installation"
  const [explicitInstallationId, setExplicitInstallationId] = useState<string | null>(null);

  const { data: githubSource } = useQuery({
    ...trpc.userSources.github.get.queryOptions(),
    enabled: provider === "github",
  });

  const { data: vercelSource } = useQuery({
    ...trpc.userSources.vercel.get.queryOptions(),
    enabled: provider === "vercel",
  });

  const userSourceId = provider === "github"
    ? githubSource?.id ?? null
    : provider === "vercel"
      ? vercelSource?.id ?? null
      : null;

  // Derive the effective installation ID without setting state during render
  // (installations ?? []).at(0) returns T | undefined - no setState during render
  const selectedInstallationId =
    explicitInstallationId ?? (githubSource?.installations ?? []).at(0)?.id ?? null;

  const setSelectedInstallationId = setExplicitInstallationId;

  const { data: workspace } = useQuery({
    ...trpc.workspace.getByName.queryOptions({ clerkOrgSlug, workspaceName }),
  });
  const workspaceId = workspace?.id ?? null;

  const [selectedResources, setSelectedResources] = useState<SelectedResource[]>([]);

  const value: ConnectFormContextValue = {
    provider,
    setProvider,
    userSourceId,
    selectedInstallationId,
    setSelectedInstallationId,
    selectedResources,
    setSelectedResources,
    clerkOrgSlug,
    workspaceName,
    workspaceId,
  };

  return (
    <ConnectFormContext.Provider value={value}>
      {children}
    </ConnectFormContext.Provider>
  );
}

export function useConnectForm() {
  const context = useContext(ConnectFormContext);
  if (!context) {
    throw new Error("useConnectForm must be used within ConnectFormProvider");
  }
  return context;
}

// Re-export types for use in other components
export type { SelectedResource };
