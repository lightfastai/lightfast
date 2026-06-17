import type { TRPCRouterRecord } from "@trpc/server";

import { workspacePeopleViewsRouter } from "./workspace-people-views";

export const workspacePeopleRouter = {
  views: workspacePeopleViewsRouter,
} satisfies TRPCRouterRecord;
