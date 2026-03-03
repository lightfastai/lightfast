"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import type { RouterOutputs } from "@repo/console-trpc/types";

/**
 * Types derived from tRPC RouterOutputs — never define manual interfaces.
 */
type GitHubListResult = NonNullable<
	RouterOutputs["connections"]["github"]["list"]
>;
export type GitHubInstallation = GitHubListResult["installations"][number];
export type Repository =
	RouterOutputs["connections"]["github"]["repositories"][number];

export type VercelInstallation =
	RouterOutputs["connections"]["vercel"]["list"]["installations"][number];
export type VercelProject =
	RouterOutputs["connections"]["vercel"]["listProjects"]["projects"][number];

type LinearConnection =
	RouterOutputs["connections"]["linear"]["get"][number];
export type LinearTeam =
	RouterOutputs["connections"]["linear"]["listTeams"]["teams"][number] & {
		installationId: string;
	};

type SentryConnection = NonNullable<
	RouterOutputs["connections"]["sentry"]["get"]
>;
export type SentryProject =
	RouterOutputs["connections"]["sentry"]["listProjects"]["projects"][number];

interface SourceSelectionState {
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
	setSelectedVercelInstallation: (
		installation: VercelInstallation | null,
	) => void;
	selectedProjects: VercelProject[];
	setSelectedProjects: (projects: VercelProject[]) => void;
	toggleProject: (project: VercelProject) => void;

	// Sentry state
	sentryConnection: SentryConnection | null;
	setSentryConnection: (connection: SentryConnection | null) => void;
	sentryInstallationId: string | null;
	setSentryInstallationId: (id: string | null) => void;
	selectedSentryProjects: SentryProject[];
	setSelectedSentryProjects: (projects: SentryProject[]) => void;
	toggleSentryProject: (project: SentryProject) => void;

	// Linear state
	linearConnections: LinearConnection[];
	setLinearConnections: (connections: LinearConnection[]) => void;
	selectedLinearTeam: LinearTeam | null;
	setSelectedLinearTeam: (team: LinearTeam | null) => void;
}

const SourceSelectionContext = createContext<SourceSelectionState | null>(null);

export function SourceSelectionProvider({ children }: { children: ReactNode }) {
	// GitHub state
	const [selectedRepositories, setSelectedRepositories] = useState<
		Repository[]
	>([]);
	const [gwInstallationId, setGwInstallationId] = useState<string | null>(
		null,
	);
	const [installations, setInstallations] = useState<GitHubInstallation[]>(
		[],
	);
	const [selectedInstallation, setSelectedInstallation] =
		useState<GitHubInstallation | null>(null);

	const toggleRepository = (repo: Repository) => {
		setSelectedRepositories((prev) => {
			const exists = prev.find((r) => r.id === repo.id);
			if (exists) return [];
			return [repo];
		});
	};

	// Vercel state
	const [vercelInstallationId, setVercelInstallationId] = useState<
		string | null
	>(null);
	const [vercelInstallations, setVercelInstallations] = useState<
		VercelInstallation[]
	>([]);
	const [selectedVercelInstallation, setSelectedVercelInstallation] =
		useState<VercelInstallation | null>(null);
	const [selectedProjects, setSelectedProjects] = useState<VercelProject[]>(
		[],
	);

	const toggleProject = (project: VercelProject) => {
		setSelectedProjects((prev) => {
			const exists = prev.find((p) => p.id === project.id);
			if (exists) return [];
			return [project];
		});
	};

	// Sentry state
	const [sentryConnection, setSentryConnection] =
		useState<SentryConnection | null>(null);
	const [sentryInstallationId, setSentryInstallationId] = useState<
		string | null
	>(null);
	const [selectedSentryProjects, setSelectedSentryProjects] = useState<
		SentryProject[]
	>([]);

	const toggleSentryProject = (project: SentryProject) => {
		setSelectedSentryProjects((prev) => {
			const exists = prev.find((p) => p.id === project.id);
			if (exists) return [];
			return [project];
		});
	};

	// Linear state
	const [linearConnections, setLinearConnections] = useState<
		LinearConnection[]
	>([]);
	const [selectedLinearTeam, setSelectedLinearTeam] =
		useState<LinearTeam | null>(null);

	return (
		<SourceSelectionContext.Provider
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
		</SourceSelectionContext.Provider>
	);
}

export function useSourceSelection() {
	const context = useContext(SourceSelectionContext);
	if (!context) {
		throw new Error(
			"useSourceSelection must be used within SourceSelectionProvider",
		);
	}
	return context;
}
