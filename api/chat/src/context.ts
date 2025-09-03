/**
 * Chat application TRPC context
 */

import { auth } from "@vendor/clerk/server";
import { db } from "@db/chat/client";
import type { BaseContext } from "@vendor/trpc";
import { $TRPCHeaderName, getHeaderFromTRPCHeaders } from "@vendor/trpc";

/**
 * Chat-specific context that extends the base context
 */
export interface ChatContext extends BaseContext {
  session: Awaited<ReturnType<typeof auth>>;
  db: typeof db;
}

/**
 * Creates the context for chat TRPC procedures
 */
export async function createChatContext(opts: {
  headers: Headers;
}): Promise<ChatContext> {
  const session = await auth();

  const source = getHeaderFromTRPCHeaders(
    opts.headers,
    $TRPCHeaderName.Enum["x-lightfast-trpc-source"],
  );

  if (session?.userId) {
    console.info(`>>> tRPC Request from ${source} by ${session.userId}`);
  } else {
    console.info(`>>> tRPC Request from ${source} by unknown`);
  }

  return {
    headers: opts.headers,
    session,
    db,
  };
}