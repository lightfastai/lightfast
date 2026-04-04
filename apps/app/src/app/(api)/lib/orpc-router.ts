import { implement } from "@orpc/server";
import { apiContract } from "@repo/app-api-contract";
import { log } from "@vendor/observability/log/next";
import { searchLogic } from "~/lib/search";
import { authMiddleware, type InitialContext } from "./orpc-middleware";

const impl = implement(apiContract)
  .$context<InitialContext>()
  .use(authMiddleware);

export const router = impl.router({
  search: impl.search.handler(async ({ input, context }) => {
    log.info("Search API request (oRPC)", { requestId: context.requestId });

    const result = await searchLogic(
      {
        clerkOrgId: context.clerkOrgId,
        userId: context.userId,
        authType: context.authType,
        apiKeyId: context.apiKeyId,
      },
      input,
      context.requestId
    );

    return result;
  }),
});
