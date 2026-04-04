import { implement, ORPCError } from "@orpc/server";
import { apiContract } from "@repo/app-api-contract";
import { log } from "@vendor/observability/log/next";
import { proxyExecuteLogic, proxySearchLogic } from "~/lib/proxy";
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

  proxy: {
    search: impl.proxy.search.handler(async ({ context }) => {
      log.info("Proxy search request (oRPC)", {
        requestId: context.requestId,
      });

      return proxySearchLogic(
        {
          clerkOrgId: context.clerkOrgId,
          userId: context.userId,
          authType: context.authType,
          apiKeyId: context.apiKeyId,
        },
        context.requestId
      );
    }),

    execute: impl.proxy.execute.handler(async ({ input, context }) => {
      log.info("Proxy execute request (oRPC)", {
        requestId: context.requestId,
        installationId: input.installationId,
        endpointId: input.endpointId,
      });

      try {
        return await proxyExecuteLogic(
          {
            clerkOrgId: context.clerkOrgId,
            userId: context.userId,
            authType: context.authType,
            apiKeyId: context.apiKeyId,
          },
          input,
          context.requestId
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Proxy execution failed";

        if (
          message.includes("not found") ||
          message.includes("access denied")
        ) {
          throw new ORPCError("NOT_FOUND", { message });
        }
        if (message.includes("not active")) {
          throw new ORPCError("BAD_REQUEST", { message });
        }
        throw error;
      }
    }),
  },
});
