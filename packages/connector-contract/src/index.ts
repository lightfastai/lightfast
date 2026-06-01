import { z } from "zod";

export const CONNECTOR_PROVIDERS = [
  "linear",
  "slack",
  "notion",
  "sentry",
] as const;
export const connectorProviderSchema = z.enum(CONNECTOR_PROVIDERS);
export type ConnectorProvider = z.infer<typeof connectorProviderSchema>;

export const CONNECTABLE_CONNECTOR_PROVIDERS = ["linear"] as const;
export const connectableConnectorProviderSchema = z.enum(
  CONNECTABLE_CONNECTOR_PROVIDERS
);
export type ConnectableConnectorProvider = z.infer<
  typeof connectableConnectorProviderSchema
>;

export const connectorConnectionStatusSchema = z.enum([
  "active",
  "error",
  "revoked",
]);
export type ConnectorConnectionStatus = z.infer<
  typeof connectorConnectionStatusSchema
>;

export const connectorCatalogStatusSchema = z.enum([
  "available",
  "coming_soon",
]);
export type ConnectorCatalogStatus = z.infer<
  typeof connectorCatalogStatusSchema
>;

export const connectorConnectUnavailableReasonSchema = z.enum([
  "missing_config",
  "permission_required",
  "coming_soon",
]);
export type ConnectorConnectUnavailableReason = z.infer<
  typeof connectorConnectUnavailableReasonSchema
>;

export const connectorToolNameSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9_.-]+$/, "Unsupported connector tool name");
export type ConnectorToolName = z.infer<typeof connectorToolNameSchema>;

export const connectorRuntimeToolNameSchema = z
  .string()
  .refine((runtimeToolName) => {
    const separatorIndex = runtimeToolName.indexOf("__");
    if (separatorIndex <= 0) {
      return false;
    }

    const provider = runtimeToolName.slice(0, separatorIndex);
    const providerToolName = runtimeToolName.slice(separatorIndex + 2);

    return (
      connectableConnectorProviderSchema.safeParse(provider).success &&
      connectorToolNameSchema.safeParse(providerToolName).success
    );
  }, "Unsupported connector runtime tool name");
export type ConnectorRuntimeToolName = z.infer<
  typeof connectorRuntimeToolNameSchema
>;

export function connectorRuntimeToolName(
  provider: ConnectableConnectorProvider,
  providerToolName: string
): ConnectorRuntimeToolName {
  const parsedProvider = connectableConnectorProviderSchema.parse(provider);
  const parsedToolName = connectorToolNameSchema.parse(providerToolName);
  return connectorRuntimeToolNameSchema.parse(
    `${parsedProvider}__${parsedToolName}`
  );
}

export function parseConnectorRuntimeToolName(
  runtimeToolName: string
): {
  provider: ConnectableConnectorProvider;
  providerToolName: ConnectorToolName;
} {
  const parsed = connectorRuntimeToolNameSchema.parse(runtimeToolName);
  const separatorIndex = parsed.indexOf("__");
  const provider = parsed.slice(0, separatorIndex);
  const providerToolName = parsed.slice(separatorIndex + 2);
  return {
    provider: connectableConnectorProviderSchema.parse(provider),
    providerToolName: connectorToolNameSchema.parse(providerToolName),
  };
}

export const fullConnectorToolManifestItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.unknown().optional(),
});
export type FullConnectorToolManifestItem = z.infer<
  typeof fullConnectorToolManifestItemSchema
>;

export const fullConnectorToolManifestSchema = z.array(
  fullConnectorToolManifestItemSchema
);
export type FullConnectorToolManifest = z.infer<
  typeof fullConnectorToolManifestSchema
>;

export const displayConnectorToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  availableForAutomations: z.boolean(),
});
export type DisplayConnectorTool = z.infer<typeof displayConnectorToolSchema>;

export const CONNECTOR_CATALOG = [
  {
    provider: "linear",
    displayName: "Linear",
    description:
      "Find, create, and manage issues, projects, and comments in Linear.",
    builder: "Lightfast",
    category: "Project management",
    catalogStatus: "available",
  },
  {
    provider: "slack",
    displayName: "Slack",
    description: "Read and manage Slack conversations.",
    builder: "Lightfast",
    category: "Communication",
    catalogStatus: "coming_soon",
  },
  {
    provider: "notion",
    displayName: "Notion",
    description: "Reference Notion pages, specs, and research.",
    builder: "Lightfast",
    category: "Knowledge",
    catalogStatus: "coming_soon",
  },
  {
    provider: "sentry",
    displayName: "Sentry",
    description: "Investigate issues, releases, and events.",
    builder: "Lightfast",
    category: "Observability",
    catalogStatus: "coming_soon",
  },
] as const satisfies ReadonlyArray<{
  provider: ConnectorProvider;
  displayName: string;
  description: string;
  builder: "Lightfast";
  category: string;
  catalogStatus: ConnectorCatalogStatus;
}>;

export const connectorStartConnectInputSchema = z.object({
  provider: connectableConnectorProviderSchema,
});

export const connectorProviderInputSchema = z.object({
  provider: connectableConnectorProviderSchema,
});

export const connectorSetAutomationEnabledInputSchema = z.object({
  provider: connectableConnectorProviderSchema,
  enabled: z.boolean(),
});
