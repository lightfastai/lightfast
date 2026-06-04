import {
  developerConnectionCompleteAuthInputSchema,
  developerConnectionConnectInputSchema,
  developerConnectionProviderInputSchema,
  developerConnectionSetSandboxEnabledInputSchema,
  developerConnectionStartAuthInputSchema,
} from "@repo/developer-connection-contract";
import { TRPCError } from "@trpc/server";
import { isDeveloperConnectionsEnabled } from "../../feature-flags";
import {
  completeSentryDeveloperConnectionAuth,
  connectDeveloperConnection,
  disconnectDeveloperConnection,
  listDeveloperConnectionsForOrg,
  setDeveloperConnectionSandboxEnabled,
  startSentryDeveloperConnectionAuth,
} from "../../services/developer-connections";
import {
  boundOrgAdminProcedure,
  boundOrgProcedure,
  createTRPCRouter,
} from "../../trpc";

function developerConnectionsNotFoundError() {
  return new TRPCError({
    code: "NOT_FOUND",
    message: "Developer connections not found",
  });
}

const developerConnectionsProcedure = boundOrgProcedure.use(
  async ({ next }) => {
    if (!(await isDeveloperConnectionsEnabled())) {
      throw developerConnectionsNotFoundError();
    }
    return next();
  }
);

const developerConnectionsAdminProcedure = boundOrgAdminProcedure.use(
  async ({ next }) => {
    if (!(await isDeveloperConnectionsEnabled())) {
      throw developerConnectionsNotFoundError();
    }
    return next();
  }
);

export const developerConnectionsRouter = createTRPCRouter({
  list: developerConnectionsProcedure.query(async ({ ctx }) =>
    listDeveloperConnectionsForOrg(ctx)
  ),
  connect: developerConnectionsAdminProcedure
    .input(developerConnectionConnectInputSchema)
    .mutation(async ({ ctx, input }) => connectDeveloperConnection(ctx, input)),
  startSentryAuth: developerConnectionsAdminProcedure
    .input(developerConnectionStartAuthInputSchema)
    .mutation(async ({ ctx, input }) =>
      startSentryDeveloperConnectionAuth(ctx, input)
    ),
  completeSentryAuth: developerConnectionsAdminProcedure
    .input(developerConnectionCompleteAuthInputSchema)
    .mutation(async ({ ctx, input }) =>
      completeSentryDeveloperConnectionAuth(ctx, input)
    ),
  setSandboxEnabled: developerConnectionsAdminProcedure
    .input(developerConnectionSetSandboxEnabledInputSchema)
    .mutation(async ({ ctx, input }) =>
      setDeveloperConnectionSandboxEnabled(ctx, input)
    ),
  disconnect: developerConnectionsAdminProcedure
    .input(developerConnectionProviderInputSchema)
    .mutation(async ({ ctx, input }) =>
      disconnectDeveloperConnection(ctx, input)
    ),
});
