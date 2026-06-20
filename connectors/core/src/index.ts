import { z } from "zod";

export const CONNECTOR_PROVIDERS = ["linear", "x"] as const;
export const connectorProviderSchema = z.enum(CONNECTOR_PROVIDERS);
export type ConnectorProvider = z.infer<typeof connectorProviderSchema>;

export const CONNECTABLE_CONNECTOR_PROVIDERS = ["linear", "x"] as const;
export const connectableConnectorProviderSchema = z.enum(
  CONNECTABLE_CONNECTOR_PROVIDERS
);
export type ConnectableConnectorProvider = z.infer<
  typeof connectableConnectorProviderSchema
>;

export const USER_CONNECTOR_PROVIDERS = ["granola"] as const;
export const userConnectorProviderSchema = z.enum(USER_CONNECTOR_PROVIDERS);
export type UserConnectorProvider = z.infer<typeof userConnectorProviderSchema>;

export const connectorToolNameSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_.-]+$/, "Unsupported connector tool name");
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

export function parseConnectorRuntimeToolName(runtimeToolName: string): {
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
