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

export const connectorConnectionStatusSchema = z.enum([
  "active",
  "error",
  "revoked",
]);
export type ConnectorConnectionStatus = z.infer<
  typeof connectorConnectionStatusSchema
>;

export const userConnectorConnectionStatusSchema =
  connectorConnectionStatusSchema;
export type UserConnectorConnectionStatus = ConnectorConnectionStatus;
