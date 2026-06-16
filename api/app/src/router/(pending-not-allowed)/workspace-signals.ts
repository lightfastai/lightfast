import type { TRPCRouterRecord } from "@trpc/server";

import { workspaceSignalViewsRouter } from "./workspace-signal-views";

export const workspaceSignalsRouter = {
  views: workspaceSignalViewsRouter,
} satisfies TRPCRouterRecord;
