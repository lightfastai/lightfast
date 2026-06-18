import type { Database } from "@db/app";
import type {
  userConnectorProviderInputSchema,
  userConnectorStartConnectInputSchema,
} from "@repo/connector-contract";
import type { z } from "zod";
import type { ResolvedAuthContext as AuthContext } from "../../auth/identity";
import { ValidationError } from "../../domain/errors";
import {
  disconnectGranolaUserConnector,
  startGranolaUserConnectorOAuth,
} from "./granola-flow";

interface UserConnectorOAuthServiceContext {
  auth: AuthContext;
  db: Database;
  headers: Headers;
}

type UserConnectorProviderInput = z.infer<
  typeof userConnectorProviderInputSchema
>;
type UserConnectorStartConnectInput = z.infer<
  typeof userConnectorStartConnectInputSchema
>;

export { listUserConnectorsForViewer } from "./catalog";
export {
  completeGranolaUserConnectorOAuth,
  disconnectGranolaUserConnector,
  startGranolaUserConnectorOAuth,
} from "./granola-flow";

function unsupportedProvider(provider: string): never {
  throw new ValidationError(
    "USER_CONNECTOR_UNSUPPORTED_PROVIDER",
    `Unsupported user connector provider: ${provider}`
  );
}

export async function startUserConnectorOAuth(
  ctx: UserConnectorOAuthServiceContext,
  input: UserConnectorStartConnectInput
) {
  switch (input.provider) {
    case "granola":
      return await startGranolaUserConnectorOAuth(ctx);
    default:
      return unsupportedProvider(input.provider);
  }
}

export async function disconnectUserConnector(
  ctx: UserConnectorOAuthServiceContext,
  input: UserConnectorProviderInput
) {
  switch (input.provider) {
    case "granola":
      return await disconnectGranolaUserConnector(ctx);
    default:
      return unsupportedProvider(input.provider);
  }
}
