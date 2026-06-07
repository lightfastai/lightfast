import {
  userConnectorProviderInputSchema,
  userConnectorStartConnectInputSchema,
} from "@repo/connector-contract";
import {
  disconnectUserConnector,
  listUserConnectorsForViewer,
  startUserConnectorOAuth,
} from "../../services/user-connectors";
import { createTRPCRouter, viewerProcedure } from "../../trpc";

export const userConnectorsRouter = createTRPCRouter({
  list: viewerProcedure.query(({ ctx }) => listUserConnectorsForViewer(ctx)),
  startConnect: viewerProcedure
    .input(userConnectorStartConnectInputSchema)
    .mutation(({ ctx, input }) => startUserConnectorOAuth(ctx, input)),
  disconnect: viewerProcedure
    .input(userConnectorProviderInputSchema)
    .mutation(({ ctx, input }) => disconnectUserConnector(ctx, input)),
});
