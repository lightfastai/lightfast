"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@repo/ui/components/ui/form";

import { workspaceFormSchema, type WorkspaceFormValues } from "@repo/console-validation/forms";

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
  updatedAt: string;
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
  // Repository selection (not in react-hook-form)
  selectedRepository: Repository | null;
  setSelectedRepository: (repo: Repository | null) => void;
  integrationId: string | null;
  setIntegrationId: (id: string | null) => void;
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
  const form = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: {
      organizationId: initialOrgId ?? "",
      workspaceName: initialWorkspaceName ?? "",
    },
    mode: "onChange", // Validate on change for real-time feedback
  });

  // Additional state for GitHub integration (not validated by form schema)
  const [selectedRepository, setSelectedRepository] = useState<Repository | null>(null);
  const [integrationId, setIntegrationId] = useState<string | null>(null);
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [selectedInstallation, setSelectedInstallation] = useState<GitHubInstallation | null>(null);

  return (
    <Form {...form}>
      <WorkspaceFormContext.Provider
        value={{
          selectedRepository,
          setSelectedRepository,
          integrationId,
          setIntegrationId,
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
