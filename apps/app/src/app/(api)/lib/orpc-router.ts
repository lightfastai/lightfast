import { implement, ORPCError } from "@orpc/server";
import { apiContract } from "@repo/app-api-contract";
import { parseError } from "@vendor/observability/error/next";
import { proxyCallLogic, proxySearchLogic } from "~/lib/proxy";
import { searchLogic } from "~/lib/search";
import {
  authMiddleware,
  type InitialContext,
  observabilityMiddleware,
} from "./orpc-middleware";

const impl = implement(apiContract)
  .$context<InitialContext>()
  .use(observabilityMiddleware)
  .use(authMiddleware);

export const router = impl.router({
  search: impl.search.handler(async ({ input, context }) => {
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
    search: impl.proxy.search.handler(async ({ context }) =>
      proxySearchLogic({
        clerkOrgId: context.clerkOrgId,
        userId: context.userId,
        authType: context.authType,
        apiKeyId: context.apiKeyId,
      })
    ),

    call: impl.proxy.call.handler(async ({ input, context }) => {
      try {
        return await proxyCallLogic(
          {
            clerkOrgId: context.clerkOrgId,
            userId: context.userId,
            authType: context.authType,
            apiKeyId: context.apiKeyId,
          },
          input
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
