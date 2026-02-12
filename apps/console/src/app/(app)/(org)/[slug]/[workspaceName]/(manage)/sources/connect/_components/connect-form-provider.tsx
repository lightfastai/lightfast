"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";

interface SelectedResource {
  id: string;
  name: string;
  fullName?: string; // For GitHub repos: "owner/repo"
}

interface ConnectFormContextValue {
  // Provider state
  provider: "github" | "vercel" | "linear" | "sentry";
  setProvider: (provider: "github" | "vercel" | "linear" | "sentry") => void;

  // Connection state (set by child components)
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
  userSourceId: string | null;
  setUserSourceId: (id: string | null) => void;

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
  setWorkspaceId: (id: string | null) => void;
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
  const [provider, setProvider] = useState<"github" | "vercel" | "linear" | "sentry">(initialProvider);
  const [isConnected, setIsConnected] = useState(false);
  const [userSourceId, setUserSourceId] = useState<string | null>(null);
  const [selectedInstallationId, setSelectedInstallationId] = useState<string | null>(null);
  const [selectedResources, setSelectedResources] = useState<SelectedResource[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const value: ConnectFormContextValue = {
    provider,
    setProvider,
    isConnected,
    setIsConnected,
    userSourceId,
    setUserSourceId,
    selectedInstallationId,
    setSelectedInstallationId,
    selectedResources,
    setSelectedResources,
    clerkOrgSlug,
    workspaceName,
    workspaceId,
    setWorkspaceId,
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
