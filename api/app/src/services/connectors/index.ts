import type { Database } from "@db/app";
import type { ConnectableConnectorProvider } from "@repo/api-contract";
import { ValidationError } from "../../domain/errors";
import { listConnectorsForOrg } from "./catalog";
import {
  disconnectLinearConnector,
  refreshLinearConnectorTools,
  setLinearConnectorAgentEnabled,
  setLinearConnectorAutomationEnabled,
  startLinearConnectorOAuth,
} from "./linear-flow";
import {
  disconnectXConnector,
  refreshXConnectorTools,
  setXConnectorAgentEnabled,
  setXConnectorAutomationEnabled,
  startXConnectorOAuth,
} from "./x-flow";

interface ConnectorServiceContext {
  actor: {
    userId: string;
  };
  db: Database;
  organization: {
    orgId: string;
  };
}

interface ConnectorProviderInput {
  provider: ConnectableConnectorProvider;
}
type ConnectorStartConnectInput = ConnectorProviderInput;
type ConnectorSetAutomationEnabledInput = ConnectorProviderInput & {
  enabled: boolean;
};
type ConnectorSetAgentEnabledInput = ConnectorProviderInput & {
  enabled: boolean;
};

export {
  type ChatProviderRoutineContext,
  ChatProviderRoutineError,
  callChatProviderRoutine,
  findChatProviderRoutines,
} from "./chat-routines";
export {
  completeLinearConnectorOAuth,
  disconnectLinearConnector,
  refreshLinearConnectorTools,
  setLinearConnectorAgentEnabled,
  setLinearConnectorAutomationEnabled,
  startLinearConnectorOAuth,
} from "./linear-flow";
export {
  completeXConnectorOAuth,
  disconnectXConnector,
  refreshXConnectorTools,
  setXConnectorAgentEnabled,
  setXConnectorAutomationEnabled,
  startXConnectorOAuth,
  type XConnectorOAuthRedirectPaths,
} from "./x-flow";
export { listConnectorsForOrg };

function unsupportedProvider(provider: string): never {
  throw new ValidationError(
    "CONNECTOR_UNSUPPORTED_PROVIDER",
    `Unsupported connector provider: ${provider}`
  );
}

export async function startConnectorOAuth(
  ctx: ConnectorServiceContext,
  input: ConnectorStartConnectInput
) {
  switch (input.provider) {
    case "linear":
      return await startLinearConnectorOAuth(ctx);
    case "x":
      return await startXConnectorOAuth(ctx);
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
    case "x":
      return await refreshXConnectorTools(ctx);
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
    case "x":
      return await setXConnectorAutomationEnabled(ctx, input);
    default:
      return unsupportedProvider(input.provider);
  }
}

export async function setConnectorAgentEnabled(
  ctx: ConnectorServiceContext,
  input: ConnectorSetAgentEnabledInput
) {
  switch (input.provider) {
    case "linear":
      return await setLinearConnectorAgentEnabled(ctx, input);
    case "x":
      return await setXConnectorAgentEnabled(ctx, input);
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
    case "x":
      return await disconnectXConnector(ctx);
    default:
      return unsupportedProvider(input.provider);
  }
}
