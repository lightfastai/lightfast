"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormCompat, Form } from "@repo/ui/components/ui/form";
import { workspaceFormSchema } from "@repo/console-validation/forms";
import type { WorkspaceFormValues } from "@repo/console-validation/forms";
import type { RouterOutputs } from "@repo/console-trpc/types";

/**
 * Types derived from tRPC RouterOutputs — never define manual interfaces.
 */
type GitHubListResult = NonNullable<RouterOutputs["connections"]["github"]["list"]>;
type GitHubInstallation = GitHubListResult["installations"][number];
type Repository = RouterOutputs["connections"]["github"]["repositories"][number];

export type VercelInstallation = RouterOutputs["connections"]["vercel"]["list"]["installations"][number];
export type VercelProject = RouterOutputs["connections"]["vercel"]["listProjects"]["projects"][number];

interface WorkspaceFormState {
  // GitHub state
  selectedRepositories: Repository[];
  setSelectedRepositories: (repos: Repository[]) => void;
  toggleRepository: (repo: Repository) => void;
  gwInstallationId: string | null;
  setGwInstallationId: (id: string | null) => void;
  installations: GitHubInstallation[];
  setInstallations: (installations: GitHubInstallation[]) => void;
  selectedInstallation: GitHubInstallation | null;
  setSelectedInstallation: (installation: GitHubInstallation | null) => void;

  // Vercel state
  vercelInstallationId: string | null;
  setVercelInstallationId: (id: string | null) => void;
  vercelInstallations: VercelInstallation[];
  setVercelInstallations: (installations: VercelInstallation[]) => void;
  selectedVercelInstallation: VercelInstallation | null;
  setSelectedVercelInstallation: (installation: VercelInstallation | null) => void;
  selectedProjects: VercelProject[];
  setSelectedProjects: (projects: VercelProject[]) => void;
  toggleProject: (project: VercelProject) => void;

  // Sentry state (org-level, no resource picker)
  sentryInstallationId: string | null;
  setSentryInstallationId: (id: string | null) => void;
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
  const [gwInstallationId, setGwInstallationId] = useState<string | null>(null);
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [selectedInstallation, setSelectedInstallation] = useState<GitHubInstallation | null>(null);

  // Toggle helper for single-repo selection (MVP: 1 repo max)
  const toggleRepository = (repo: Repository) => {
    setSelectedRepositories((prev) => {
      const exists = prev.find((r) => r.id === repo.id);
      if (exists) return [];
      return [repo];
    });
  };

  // Additional state for Vercel integration
  const [vercelInstallationId, setVercelInstallationId] = useState<string | null>(null);
  const [vercelInstallations, setVercelInstallations] = useState<VercelInstallation[]>([]);
  const [selectedVercelInstallation, setSelectedVercelInstallation] = useState<VercelInstallation | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<VercelProject[]>([]);

  // Additional state for Sentry integration (org-level, no resource picker)
  const [sentryInstallationId, setSentryInstallationId] = useState<string | null>(null);

  // Toggle helper for single-project selection (MVP: 1 project max)
  const toggleProject = (project: VercelProject) => {
    setSelectedProjects((prev) => {
      const exists = prev.find((p) => p.id === project.id);
      if (exists) return [];
      return [project];
    });
  };

  return (
    <Form {...form}>
      <WorkspaceFormContext.Provider
        value={{
          selectedRepositories,
          setSelectedRepositories,
          toggleRepository,
          gwInstallationId,
          setGwInstallationId,
          installations,
          setInstallations,
          selectedInstallation,
          setSelectedInstallation,
          vercelInstallationId,
          setVercelInstallationId,
          vercelInstallations,
          setVercelInstallations,
          selectedVercelInstallation,
          setSelectedVercelInstallation,
          selectedProjects,
          setSelectedProjects,
          toggleProject,
          sentryInstallationId,
          setSentryInstallationId,
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
