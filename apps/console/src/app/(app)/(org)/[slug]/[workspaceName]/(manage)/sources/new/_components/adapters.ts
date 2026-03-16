import type { OrgRouter } from "@api/console";
import type { ProviderName } from "@repo/console-providers";
import { PROVIDER_SLUGS } from "@repo/console-providers";
import type { RouterOutputs } from "@repo/console-trpc/types";
import type {
  TRPCOptionsProxy,
  TRPCQueryOptions,
} from "@trpc/tanstack-react-query";

// ── tRPC types ───────────────────────────────────────────────────────────────

// tRPC proxy type — accepts both useTRPC() and orgTrpc
type TRPCProxy = TRPCOptionsProxy<OrgRouter>;

// Query options return type (same pattern as prefetch() in server.tsx)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryOpts = ReturnType<TRPCQueryOptions<any>>;

// ── Connection output types ──────────────────────────────────────────────────

type GitHubListOutput = NonNullable<
  RouterOutputs["connections"]["github"]["list"]
>;
type VercelListOutput = RouterOutputs["connections"]["vercel"]["list"];
type LinearGetOutput = RouterOutputs["connections"]["linear"]["get"];
type SentryGetOutput = RouterOutputs["connections"]["sentry"]["get"];

// ── Resource output types ────────────────────────────────────────────────────

type GitHubReposOutput = RouterOutputs["connections"]["github"]["repositories"];
type VercelProjectsOutput =
  RouterOutputs["connections"]["vercel"]["listProjects"];
type LinearTeamsOutput = RouterOutputs["connections"]["linear"]["listTeams"];
type SentryProjectsOutput =
  RouterOutputs["connections"]["sentry"]["listProjects"];

// ── Normalized Types ─────────────────────────────────────────────────────────

export interface NormalizedInstallation {
  avatarUrl?: string | null;
  externalId: string;
  id: string;
  label: string;
}

export interface NormalizedResource {
  badge?: string | null;
  iconColor?: string | null;
  iconLabel?: string | null;
  id: string;
  name: string;
  subtitle?: string | null;
}

// ── Adapter Interface ────────────────────────────────────────────────────────

export type InstallationMode = "multi" | "merged" | "single";

export interface ProviderConnectAdapter {
  /**
   * Build the `resources` array for the generic `bulkLinkResources` mutation.
   * Maps raw tRPC response items to `{ resourceId, resourceName, metadata }`.
   */
  buildLinkResources: (rawResources: unknown[]) => {
    resourceId: string;
    resourceName: string;
  }[];

  /** Optional: custom OAuth URL builder (GitHub "Adjust permissions") */
  customConnectUrl?: (data: { url: string; state: string }) => string;
  extractInstallations: (data: unknown) => NormalizedInstallation[];
  /** Extract raw resource items from query data for buildLinkResources. */
  extractRawResources: (data: unknown) => Record<string, unknown>[];
  extractResources: (data: unknown) => NormalizedResource[];

  getConnectionQueryOptions: (trpc: TRPCProxy) => QueryOpts;
  getResourceQueryOptions: (
    trpc: TRPCProxy,
    installationId: string,
    externalId: string
  ) => QueryOpts;
  installationMode: InstallationMode;
  provider: ProviderName;
  resourceLabel: string;
  resourceQueryKeys: readonly (readonly unknown[])[];
}

// ── GitHub ────────────────────────────────────────────────────────────────────

const githubAdapter: ProviderConnectAdapter = {
  provider: "github",
  installationMode: "multi",
  resourceLabel: "repositories",
  resourceQueryKeys: [["connections", "github", "repositories"]],

  getConnectionQueryOptions: (trpc) =>
    trpc.connections.github.list.queryOptions(),

  extractInstallations: (data) => {
    const d = data as GitHubListOutput | null;
    if (!d) {
      return [];
    }
    return d.installations.map((inst) => ({
      id: inst.gwInstallationId,
      externalId: inst.id,
      label: inst.accountLogin,
      avatarUrl: inst.avatarUrl,
    }));
  },

  getResourceQueryOptions: (trpc, installationId, externalId) =>
    trpc.connections.github.repositories.queryOptions({
      integrationId: installationId,
      installationId: externalId,
    }),

  extractResources: (data) =>
    (data as GitHubReposOutput).map((repo) => ({
      id: repo.id,
      name: repo.name,
      subtitle: repo.description,
      badge: repo.isPrivate ? "Private" : null,
    })),

  extractRawResources: (data) =>
    (data as GitHubReposOutput).map((r) => ({ ...r })),

  buildLinkResources: (rawResources) =>
    (rawResources as { id: string; name: string }[]).map((r) => ({
      resourceId: r.id,
      resourceName: r.name,
    })),

  customConnectUrl: (data) => {
    const slug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG;
    return `https://github.com/apps/${slug}/installations/select_target?state=${data.state}`;
  },
};

// ── Vercel ────────────────────────────────────────────────────────────────────

const vercelAdapter: ProviderConnectAdapter = {
  provider: "vercel",
  installationMode: "multi",
  resourceLabel: "projects",
  resourceQueryKeys: [["connections", "vercel", "listProjects"]],

  getConnectionQueryOptions: (trpc) =>
    trpc.connections.vercel.list.queryOptions(),

  extractInstallations: (data) => {
    const d = data as VercelListOutput;
    return d.installations.map((inst) => ({
      id: inst.id,
      externalId: inst.id,
      label: inst.accountLogin,
    }));
  },

  getResourceQueryOptions: (trpc, installationId) =>
    trpc.connections.vercel.listProjects.queryOptions({ installationId }),

  extractResources: (data) => {
    const d = data as VercelProjectsOutput;
    return d.projects.map((p) => ({
      id: p.id,
      name: p.name,
      badge: p.framework,
    }));
  },

  extractRawResources: (data) => {
    const d = data as VercelProjectsOutput;
    return d.projects.map((p) => ({ ...p }));
  },

  buildLinkResources: (rawResources) =>
    (rawResources as { id: string; name: string }[]).map((p) => ({
      resourceId: p.id,
      resourceName: p.name,
    })),
};

// ── Linear ────────────────────────────────────────────────────────────────────

const linearAdapter: ProviderConnectAdapter = {
  provider: "linear",
  installationMode: "merged",
  resourceLabel: "teams",
  resourceQueryKeys: [["connections", "linear", "listTeams"]],

  getConnectionQueryOptions: (trpc) =>
    trpc.connections.linear.get.queryOptions(),

  extractInstallations: (data) =>
    (data as LinearGetOutput).map((conn) => ({
      id: conn.id,
      externalId: conn.id,
      label: conn.organizationName ?? conn.id,
    })),

  getResourceQueryOptions: (trpc, installationId) =>
    trpc.connections.linear.listTeams.queryOptions({ installationId }),

  extractResources: (data) => {
    const d = data as LinearTeamsOutput;
    return d.teams.map((t) => ({
      id: t.id,
      name: t.name,
      subtitle: t.description,
      badge: t.key,
      iconColor: t.color,
      iconLabel: t.key,
    }));
  },

  extractRawResources: (data) => {
    const d = data as LinearTeamsOutput;
    return d.teams.map((t) => ({ ...t }));
  },

  buildLinkResources: (rawResources) =>
    (rawResources as { id: string; name: string }[]).map((t) => ({
      resourceId: t.id,
      resourceName: t.name,
    })),
};

// ── Sentry ────────────────────────────────────────────────────────────────────

const sentryAdapter: ProviderConnectAdapter = {
  provider: "sentry",
  installationMode: "single",
  resourceLabel: "projects",
  resourceQueryKeys: [["connections", "sentry", "listProjects"]],

  getConnectionQueryOptions: (trpc) =>
    trpc.connections.sentry.get.queryOptions(),

  extractInstallations: (data) => {
    const d = data as SentryGetOutput;
    if (!d) {
      return [];
    }
    return [{ id: d.id, externalId: d.id, label: "Sentry" }];
  },

  getResourceQueryOptions: (trpc, installationId) =>
    trpc.connections.sentry.listProjects.queryOptions({ installationId }),

  extractResources: (data) => {
    const d = data as SentryProjectsOutput;
    return d.projects.map((p) => ({
      id: p.id,
      name: p.name,
      subtitle: p.slug,
      badge: p.platform,
    }));
  },

  extractRawResources: (data) => {
    const d = data as SentryProjectsOutput;
    return d.projects.map((p) => ({ ...p }));
  },

  buildLinkResources: (rawResources) =>
    (rawResources as { id: string; name: string }[]).map((p) => ({
      resourceId: p.id,
      resourceName: p.name,
    })),
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const ADAPTERS: Record<ProviderName, ProviderConnectAdapter> = {
  github: githubAdapter,
  vercel: vercelAdapter,
  linear: linearAdapter,
  sentry: sentryAdapter,
};

export const ORDERED_ADAPTERS = PROVIDER_SLUGS.map((key) => ADAPTERS[key]);
