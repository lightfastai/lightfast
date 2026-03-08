"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { RouterOutputs } from "@repo/console-trpc/types";
import type { WorkspaceFormValues } from "@repo/console-validation/forms";
import { workspaceFormSchema } from "@repo/console-validation/forms";
import { Form, useFormCompat } from "@repo/ui/components/ui/form";
import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";

/**
 * Types derived from tRPC RouterOutputs — never define manual interfaces.
 */
type GitHubListResult = NonNullable<
  RouterOutputs["connections"]["github"]["list"]
>;
type GitHubInstallation = GitHubListResult["installations"][number];
type Repository =
  RouterOutputs["connections"]["github"]["repositories"][number];

export type VercelInstallation =
  RouterOutputs["connections"]["vercel"]["list"]["installations"][number];
export type VercelProject =
  RouterOutputs["connections"]["vercel"]["listProjects"]["projects"][number];

type LinearConnection = RouterOutputs["connections"]["linear"]["get"][number];
export type LinearTeam =
  RouterOutputs["connections"]["linear"]["listTeams"]["teams"][number] & {
    installationId: string;
  };

type SentryConnection = NonNullable<
  RouterOutputs["connections"]["sentry"]["get"]
>;
export type SentryProject =
  RouterOutputs["connections"]["sentry"]["listProjects"]["projects"][number];

interface WorkspaceFormState {
  gwInstallationId: string | null;
  installations: GitHubInstallation[];

  // Linear state (org-level connections with team picker)
  linearConnections: LinearConnection[];
  selectedInstallation: GitHubInstallation | null;
  selectedLinearTeam: LinearTeam | null;
  selectedProjects: VercelProject[];
  // GitHub state
  selectedRepositories: Repository[];
  selectedSentryProjects: SentryProject[];
  selectedVercelInstallation: VercelInstallation | null;

  // Sentry state (org-level connection with project picker)
  sentryConnection: SentryConnection | null;
  sentryInstallationId: string | null;
  setGwInstallationId: (id: string | null) => void;
  setInstallations: (installations: GitHubInstallation[]) => void;
  setLinearConnections: (connections: LinearConnection[]) => void;
  setSelectedInstallation: (installation: GitHubInstallation | null) => void;
  setSelectedLinearTeam: (team: LinearTeam | null) => void;
  setSelectedProjects: (projects: VercelProject[]) => void;
  setSelectedRepositories: (repos: Repository[]) => void;
  setSelectedSentryProjects: (projects: SentryProject[]) => void;
  setSelectedVercelInstallation: (
    installation: VercelInstallation | null
  ) => void;
  setSentryConnection: (connection: SentryConnection | null) => void;
  setSentryInstallationId: (id: string | null) => void;
  setVercelInstallationId: (id: string | null) => void;
  setVercelInstallations: (installations: VercelInstallation[]) => void;
  toggleProject: (project: VercelProject) => void;
  toggleRepository: (repo: Repository) => void;
  toggleSentryProject: (project: SentryProject) => void;

  // Vercel state
  vercelInstallationId: string | null;
  vercelInstallations: VercelInstallation[];
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
  const [selectedRepositories, setSelectedRepositories] = useState<
    Repository[]
  >([]);
  const [gwInstallationId, setGwInstallationId] = useState<string | null>(null);
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [selectedInstallation, setSelectedInstallation] =
    useState<GitHubInstallation | null>(null);

  // Toggle helper for single-repo selection (MVP: 1 repo max)
  const toggleRepository = (repo: Repository) => {
    setSelectedRepositories((prev) => {
      const exists = prev.find((r) => r.id === repo.id);
      if (exists) {
        return [];
      }
      return [repo];
    });
  };

  // Additional state for Vercel integration
  const [vercelInstallationId, setVercelInstallationId] = useState<
    string | null
  >(null);
  const [vercelInstallations, setVercelInstallations] = useState<
    VercelInstallation[]
  >([]);
  const [selectedVercelInstallation, setSelectedVercelInstallation] =
    useState<VercelInstallation | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<VercelProject[]>([]);

  // Additional state for Sentry integration (org-level connection + project picker)
  const [sentryConnection, setSentryConnection] =
    useState<SentryConnection | null>(null);
  const [sentryInstallationId, setSentryInstallationId] = useState<
    string | null
  >(null);
  const [selectedSentryProjects, setSelectedSentryProjects] = useState<
    SentryProject[]
  >([]);

  // Toggle helper for single-project selection (MVP: 1 project max)
  const toggleSentryProject = (project: SentryProject) => {
    setSelectedSentryProjects((prev) => {
      const exists = prev.find((p) => p.id === project.id);
      if (exists) {
        return [];
      }
      return [project];
    });
  };

  // Additional state for Linear integration (org-level connections + team picker)
  const [linearConnections, setLinearConnections] = useState<
    LinearConnection[]
  >([]);
  const [selectedLinearTeam, setSelectedLinearTeam] =
    useState<LinearTeam | null>(null);

  // Toggle helper for single-project selection (MVP: 1 project max)
  const toggleProject = (project: VercelProject) => {
    setSelectedProjects((prev) => {
      const exists = prev.find((p) => p.id === project.id);
      if (exists) {
        return [];
      }
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
          sentryConnection,
          setSentryConnection,
          sentryInstallationId,
          setSentryInstallationId,
          selectedSentryProjects,
          setSelectedSentryProjects,
          toggleSentryProject,
          linearConnections,
          setLinearConnections,
          selectedLinearTeam,
          setSelectedLinearTeam,
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
    throw new Error(
      "useWorkspaceForm must be used within WorkspaceFormProvider"
    );
  }
  return context;
}

// Re-export types for use in other components
export type { Repository, GitHubInstallation };
