import type { Database } from "@db/app";
import type {
  userConnectorProviderInputSchema,
  userConnectorStartConnectInputSchema,
} from "@repo/connector-contract";
import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import type { AuthContext } from "../../trpc";
import {
  disconnectGranolaUserConnector,
  startGranolaUserConnectorOAuth,
} from "./granola-flow";

interface UserConnectorServiceContext {
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
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Unsupported user connector provider: ${provider}`,
  });
}

export async function startUserConnectorOAuth(
  ctx: UserConnectorServiceContext,
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
  ctx: UserConnectorServiceContext,
  input: UserConnectorProviderInput
) {
  switch (input.provider) {
    case "granola":
      return await disconnectGranolaUserConnector(ctx);
    default:
      return unsupportedProvider(input.provider);
  }
}
