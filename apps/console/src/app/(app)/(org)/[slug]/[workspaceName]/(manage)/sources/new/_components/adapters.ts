import type { ProviderName } from "@repo/console-providers";
import { PROVIDER_SLUGS } from "@repo/console-providers";

// ── Normalized Types ─────────────────────────────────────────────────────────

export interface NormalizedInstallation {
  id: string;
  externalId: string;
  label: string;
  avatarUrl?: string | null;
}

export interface NormalizedResource {
  id: string;
  name: string;
  subtitle?: string | null;
  badge?: string | null;
  iconColor?: string | null;
  iconLabel?: string | null;
}

// ── Adapter Interface ────────────────────────────────────────────────────────

export type InstallationMode = "multi" | "merged" | "single";

export interface ProviderConnectAdapter {
  provider: ProviderName;
  installationMode: InstallationMode;
  resourceLabel: string;
  resourceQueryKeys: readonly (readonly unknown[])[];

  getConnectionQueryOptions: (trpc: any) => any;
  extractInstallations: (data: unknown) => NormalizedInstallation[];
  getResourceQueryOptions: (trpc: any, installationId: string, externalId: string) => any;
  extractResources: (data: unknown) => NormalizedResource[];

  /**
   * Build the `resources` array for the generic `bulkLinkResources` mutation.
   * Maps raw tRPC response items to `{ resourceId, resourceName, metadata }`.
   */
  buildLinkResources: (rawResources: unknown[]) => Array<{
    resourceId: string;
    resourceName: string;
  }>;

  /** Optional: custom OAuth URL builder (GitHub "Adjust permissions") */
  customConnectUrl?: (data: { url: string; state: string }) => string;
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
    if (!data) return [];
    const d = data as any;
    return (d.installations ?? []).map((inst: any) => ({
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
    ((data as any[]) ?? []).map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      subtitle: repo.description,
      badge: repo.isPrivate ? "Private" : null,
    })),

  buildLinkResources: (rawResources) =>
    (rawResources as any[]).map((r) => ({
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
    const d = data as any;
    return (d?.installations ?? []).map((inst: any) => ({
      id: inst.id,
      externalId: inst.id,
      label: inst.accountLogin,
    }));
  },

  getResourceQueryOptions: (trpc, installationId) =>
    trpc.connections.vercel.listProjects.queryOptions({ installationId }),

  extractResources: (data) =>
    ((data as any)?.projects ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      badge: p.framework,
    })),

  buildLinkResources: (rawResources) =>
    (rawResources as any[]).map((p) => ({
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
    ((data as any[]) ?? []).map((conn: any) => ({
      id: conn.id,
      externalId: conn.id,
      label: conn.organizationName ?? conn.id,
    })),

  getResourceQueryOptions: (trpc, installationId) =>
    trpc.connections.linear.listTeams.queryOptions({ installationId }),

  extractResources: (data) =>
    ((data as any)?.teams ?? []).map((t: any) => ({
      id: t.id,
      name: t.name,
      subtitle: t.description,
      badge: t.key,
      iconColor: t.color,
      iconLabel: t.key,
    })),

  buildLinkResources: (rawResources) =>
    (rawResources as any[]).map((t) => ({
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
    if (!data) return [];
    const d = data as any;
    return [{ id: d.id, externalId: d.id, label: "Sentry" }];
  },

  getResourceQueryOptions: (trpc, installationId) =>
    trpc.connections.sentry.listProjects.queryOptions({ installationId }),

  extractResources: (data) =>
    ((data as any)?.projects ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      subtitle: p.slug,
      badge: p.platform,
    })),

  buildLinkResources: (rawResources) =>
    (rawResources as any[]).map((p) => ({
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
