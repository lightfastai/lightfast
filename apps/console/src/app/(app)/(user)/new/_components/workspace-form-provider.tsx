"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormCompat, Form } from "@repo/ui/components/ui/form";
import { workspaceFormSchema } from "@repo/console-validation/forms";
import type { WorkspaceFormValues } from "@repo/console-validation/forms";

/**
 * Workspace Form State
 * Shared state across all form sections (beyond react-hook-form)
 */
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
  updatedAt: string | null;
}

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

interface WorkspaceFormState {
  // Multi-repo selection (not in react-hook-form)
  selectedRepositories: Repository[];
  setSelectedRepositories: (repos: Repository[]) => void;
  toggleRepository: (repo: Repository) => void;
  userSourceId: string | null;
  setUserSourceId: (id: string | null) => void;
  installations: GitHubInstallation[];
  setInstallations: (installations: GitHubInstallation[]) => void;
  selectedInstallation: GitHubInstallation | null;
  setSelectedInstallation: (installation: GitHubInstallation | null) => void;
}

const WorkspaceFormContext = createContext<WorkspaceFormState | null>(null);

export function WorkspaceFormProvider({
  children,
  initialOrgId,
  initialWorkspaceName,
}: {
  children: ReactNode;
  initialOrgId?: string;
  initialWorkspaceName?: string;
}) {
  // react-hook-form for validated fields
  const form = useFormCompat<WorkspaceFormValues>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: {
      organizationId: initialOrgId ?? "",
      workspaceName: initialWorkspaceName ?? "",
    },
    mode: "onChange", // Validate on change for real-time feedback
  });

  // Additional state for GitHub integration (not validated by form schema)
  const [selectedRepositories, setSelectedRepositories] = useState<Repository[]>([]);
  const [userSourceId, setUserSourceId] = useState<string | null>(null);
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [selectedInstallation, setSelectedInstallation] = useState<GitHubInstallation | null>(null);

  // Toggle helper for multi-repo selection
  const toggleRepository = (repo: Repository) => {
    setSelectedRepositories((prev) => {
      const exists = prev.find((r) => r.id === repo.id);
      if (exists) {
        return prev.filter((r) => r.id !== repo.id);
      }
      return [...prev, repo];
    });
  };

  return (
    <Form {...form}>
      <WorkspaceFormContext.Provider
        value={{
          selectedRepositories,
          setSelectedRepositories,
          toggleRepository,
          userSourceId,
          setUserSourceId,
          installations,
          setInstallations,
          selectedInstallation,
          setSelectedInstallation,
        }}
      >
        {children}
      </WorkspaceFormContext.Provider>
    </Form>
  );
}

export function useWorkspaceForm() {
  const context = useContext(WorkspaceFormContext);
  if (!context) {
    throw new Error("useWorkspaceForm must be used within WorkspaceFormProvider");
  }
  return context;
}

// Re-export types for use in other components
export type { Repository, GitHubInstallation };
