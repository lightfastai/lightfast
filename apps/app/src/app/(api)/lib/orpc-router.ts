import { implement, ORPCError } from "@orpc/server";
import { apiContract } from "@repo/app-api-contract";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { proxyCallLogic, proxySearchLogic } from "~/lib/proxy";
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

    call: impl.proxy.call.handler(async ({ input, context }) => {
      log.info("Proxy call request (oRPC)", {
        requestId: context.requestId,
        action: input.action,
      });

      try {
        return await proxyCallLogic(
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
        const message = parseError(error);

        if (
          message.includes("not found") ||
          message.includes("access denied")
        ) {
          throw new ORPCError("NOT_FOUND", { message });
        }
        if (
          message.includes("not active") ||
          message.includes("not connected") ||
          message.includes("Invalid action") ||
          message.includes("Unknown") ||
          message.includes("mismatch")
        ) {
          throw new ORPCError("BAD_REQUEST", { message });
        }
        throw error;
      }
    }),
  },
});
