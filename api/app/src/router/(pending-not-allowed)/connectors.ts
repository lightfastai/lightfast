import {
  connectorProviderInputSchema,
  connectorSetAutomationEnabledInputSchema,
  connectorStartConnectInputSchema,
} from "@repo/connector-contract";

import {
  disconnectConnector,
  listConnectorsForOrg,
  refreshConnectorTools,
  setConnectorAutomationEnabled,
  startConnectorOAuth,
} from "../../services/connectors";
import {
  boundOrgAdminProcedure,
  boundOrgProcedure,
  createTRPCRouter,
} from "../../trpc";

export const connectorsRouter = createTRPCRouter({
  list: boundOrgProcedure.query(async ({ ctx }) => {
    return listConnectorsForOrg(ctx);
  }),
  startConnect: boundOrgAdminProcedure
    .input(connectorStartConnectInputSchema)
    .mutation(async ({ ctx, input }) => startConnectorOAuth(ctx, input)),
  refreshTools: boundOrgAdminProcedure
    .input(connectorProviderInputSchema)
    .mutation(async ({ ctx, input }) => refreshConnectorTools(ctx, input)),
  setAutomationEnabled: boundOrgAdminProcedure
    .input(connectorSetAutomationEnabledInputSchema)
    .mutation(async ({ ctx, input }) =>
      setConnectorAutomationEnabled(ctx, input)
    ),
  disconnect: boundOrgAdminProcedure
    .input(connectorProviderInputSchema)
    .mutation(async ({ ctx, input }) => disconnectConnector(ctx, input)),
});
