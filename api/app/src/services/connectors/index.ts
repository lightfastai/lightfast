import type { Database } from "@db/app";
import type {
  connectorProviderInputSchema,
  connectorSetAutomationEnabledInputSchema,
  connectorStartConnectInputSchema,
} from "@repo/connector-contract";
import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import type { AuthContext } from "../../trpc";
import { listConnectorsForOrg } from "./catalog";
import {
  disconnectLinearConnector,
  refreshLinearConnectorTools,
  setLinearConnectorAutomationEnabled,
  startLinearConnectorOAuth,
} from "./linear-flow";

interface ConnectorServiceContext {
  auth: AuthContext;
  db: Database;
  headers: Headers;
}

type ConnectorProviderInput = z.infer<typeof connectorProviderInputSchema>;
type ConnectorStartConnectInput = z.infer<
  typeof connectorStartConnectInputSchema
>;
type ConnectorSetAutomationEnabledInput = z.infer<
  typeof connectorSetAutomationEnabledInputSchema
>;

export {
  completeLinearConnectorOAuth,
  disconnectLinearConnector,
  refreshLinearConnectorTools,
  setLinearConnectorAutomationEnabled,
  startLinearConnectorOAuth,
} from "./linear-flow";
export { listConnectorsForOrg };

function unsupportedProvider(provider: string): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Unsupported connector provider: ${provider}`,
  });
}

export async function startConnectorOAuth(
  ctx: ConnectorServiceContext,
  input: ConnectorStartConnectInput
) {
  switch (input.provider) {
    case "linear":
      return await startLinearConnectorOAuth(ctx);
    default:
      return unsupportedProvider(input.provider);
  }
}

export async function refreshConnectorTools(
  ctx: ConnectorServiceContext,
  input: ConnectorProviderInput
) {
  switch (input.provider) {
    case "linear":
      return await refreshLinearConnectorTools(ctx);
    default:
      return unsupportedProvider(input.provider);
  }
}

export async function setConnectorAutomationEnabled(
  ctx: ConnectorServiceContext,
  input: ConnectorSetAutomationEnabledInput
) {
  switch (input.provider) {
    case "linear":
      return await setLinearConnectorAutomationEnabled(ctx, input);
    default:
      return unsupportedProvider(input.provider);
  }
}

export async function disconnectConnector(
  ctx: ConnectorServiceContext,
  input: ConnectorProviderInput
) {
  switch (input.provider) {
    case "linear":
      return await disconnectLinearConnector(ctx);
    default:
      return unsupportedProvider(input.provider);
  }
}
