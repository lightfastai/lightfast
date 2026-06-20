export {
  CONNECTABLE_CONNECTOR_PROVIDERS,
  CONNECTOR_PROVIDERS,
  type ConnectableConnectorProvider,
  type ConnectorProvider,
  connectableConnectorProviderSchema,
  connectorProviderSchema,
  USER_CONNECTOR_PROVIDERS,
  type UserConnectorProvider,
  userConnectorProviderSchema,
} from "@lightfast/connector-core";

import { z } from "zod";

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
