import {
  developerConnectionCompleteAuthInputSchema,
  developerConnectionConnectInputSchema,
  developerConnectionProviderInputSchema,
  developerConnectionSetSandboxEnabledInputSchema,
  developerConnectionStartAuthInputSchema,
} from "@repo/developer-connection-contract";
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

export const developerConnectionsRouter = createTRPCRouter({
  list: boundOrgProcedure.query(async ({ ctx }) =>
    listDeveloperConnectionsForOrg(ctx)
  ),
  connect: boundOrgAdminProcedure
    .input(developerConnectionConnectInputSchema)
    .mutation(async ({ ctx, input }) => connectDeveloperConnection(ctx, input)),
  startSentryAuth: boundOrgAdminProcedure
    .input(developerConnectionStartAuthInputSchema)
    .mutation(async ({ ctx, input }) =>
      startSentryDeveloperConnectionAuth(ctx, input)
    ),
  completeSentryAuth: boundOrgAdminProcedure
    .input(developerConnectionCompleteAuthInputSchema)
    .mutation(async ({ ctx, input }) =>
      completeSentryDeveloperConnectionAuth(ctx, input)
    ),
  setSandboxEnabled: boundOrgAdminProcedure
    .input(developerConnectionSetSandboxEnabledInputSchema)
    .mutation(async ({ ctx, input }) =>
      setDeveloperConnectionSandboxEnabled(ctx, input)
    ),
  disconnect: boundOrgAdminProcedure
    .input(developerConnectionProviderInputSchema)
    .mutation(async ({ ctx, input }) =>
      disconnectDeveloperConnection(ctx, input)
    ),
});
