import type { ProxyExecuteResponse } from "./api";

/** Callback signature for gateway proxy calls inside resourcePicker functions.
 *  The generic tRPC procedure binds the installationId and passes this to the provider. */
export type ResourcePickerExecuteApiFn = (request: {
  endpointId: string;
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: unknown;
}) => Promise<ProxyExecuteResponse>;

export interface NormalizedInstallation {
  readonly avatarUrl?: string | null;
  readonly externalId: string;
  readonly id: string;
  readonly label: string;
}

export interface NormalizedResource {
  readonly badge?: string | null;
  readonly iconColor?: string | null;
  readonly iconLabel?: string | null;
  readonly id: string;
  /** Resource name used when linking via bulkLinkResources.
   *  Falls back to `name` when absent. Sentry uses "orgSlug/projectSlug". */
  readonly linkName?: string;
  readonly name: string;
  readonly subtitle?: string | null;
}

export type InstallationMode = "multi" | "merged" | "single";

export interface ResourcePickerDef {
  /** Enrich a gateway installation with display data from the provider API.
   *  Called once per installation. Should handle errors internally and return fallback data. */
  readonly enrichInstallation: (
    executeApi: ResourcePickerExecuteApiFn,
    installation: {
      id: string;
      externalId: string;
      providerAccountInfo: unknown;
    }
  ) => Promise<NormalizedInstallation>;
  /** How installations are displayed: multi=select dropdown, merged=all fetched, single=static label */
  readonly installationMode: InstallationMode;

  /** List resources for a single installation, returning normalized items.
   *  Called per installation (merged mode calls this for each).
   *  Installation context is included so providers can read providerAccountInfo
   *  (e.g. Vercel needs team_id from providerAccountInfo.raw to scope the API call). */
  readonly listResources: (
    executeApi: ResourcePickerExecuteApiFn,
    installation: {
      readonly id: string;
      readonly externalId: string;
      readonly providerAccountInfo: unknown;
    }
  ) => Promise<NormalizedResource[]>;
  /** Human label for resources, e.g. "repositories", "projects", "teams" */
  readonly resourceLabel: string;
}
